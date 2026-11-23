"""Review and validate an exact Star component delta, without changing public scope.

Generating this file is a review step. The updater requires it explicitly and
rechecks both bound release manifests and the complete candidate tree.
"""
from pathlib import Path, PurePosixPath
import argparse
import json
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import digest, manifest_entries, no_links, verify_tree
from public_scope import public_payload
from release_privacy import state_path

PREFIXES = ("star-runtime/", "assets/star-native/")
BACKEND_MANIFEST = "star-runtime/_backend-prepared-manifest.json"


def allowed_path(name):
    if not isinstance(name, str) or not name.startswith(PREFIXES) or state_path(name):
        return False
    pure = PurePosixPath(name)
    if pure.as_posix() != name or pure.is_absolute() or ".." in pure.parts:
        return False
    return not any(re.search(r'[<>:"\\|?*\x00-\x1f]', part) or part.endswith((".", " "))
                   or part.casefold() in {".git", "node_modules", "__pycache__"}
                   for part in pure.parts)


def entries(path):
    no_links(path)
    return {name: {"path": name, "size": size, "sha256": sha}
            for name, (size, sha) in manifest_entries(path).items()}


def restricted_delta(old, current):
    names = old.keys() | current.keys()
    if len({name.casefold() for name in names}) != len(names):
        raise ValueError("Case-only path changes require a full installer")
    rows = []
    for name in sorted(names):
        before, after = old.get(name), current.get(name)
        if before == after or (after and public_payload(name)):
            continue
        if not allowed_path(name):
            raise ValueError("Changed/deleted file is outside the Star component allowlist: " + name)
        rows.append({"path": name, "action": "replace" if after else "remove",
                     "previousSha256": before["sha256"] if before else "",
                     "sha256": after["sha256"] if after else "",
                     "size": after["size"] if after else 0})
    return rows


def make_review(baseline, candidate_manifest, from_version, to_version):
    for version in (from_version, to_version):
        if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version):
            raise ValueError("Star component versions must be three-part versions")
    old, current = entries(baseline), entries(candidate_manifest)
    if BACKEND_MANIFEST not in old or BACKEND_MANIFEST not in current:
        raise ValueError("Both releases must include the prepared Star manifest")
    rows = restricted_delta(old, current)
    if not rows:
        raise ValueError("No restricted Star component changes to review")
    return {"schema": 1, "component": "xingchan", "fromVersion": from_version,
            "toVersion": to_version, "baselineManifestSha256": digest(baseline),
            "candidateManifestSha256": digest(candidate_manifest), "files": rows}


def validate_review(review_path, baseline, candidate_manifest, candidate):
    for file in (review_path, baseline, candidate_manifest):
        no_links(file)
    review = json.loads(review_path.read_text(encoding="utf-8-sig"))
    if not isinstance(review, dict) or type(review.get("schema")) is not int or review.get("schema") != 1 or review.get("component") != "xingchan":
        raise ValueError("Invalid Star delta review format")
    expected = make_review(baseline, candidate_manifest, review.get("fromVersion", ""), review.get("toVersion", ""))
    if json.dumps(review, sort_keys=True) != json.dumps(expected, sort_keys=True):
        raise ValueError("Star delta review is stale, incomplete, or contains unreviewed paths/hashes")
    verify_tree(candidate, candidate_manifest)
    metadata = json.loads((candidate / "fusion-install.json").read_text(encoding="utf-8-sig"))
    if metadata.get("dependencies", {}).get("xingchan") != review["toVersion"]:
        raise ValueError("Candidate Star version does not match the reviewed delta")
    return review


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--candidate-manifest", required=True, type=Path)
    parser.add_argument("--from-version", required=True)
    parser.add_argument("--to-version", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    no_links(args.output)
    value = make_review(args.baseline, args.candidate_manifest, args.from_version, args.to_version)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
    print(json.dumps({"review": str(args.output), "files": len(value["files"]), "compiled": False}, ensure_ascii=True))
