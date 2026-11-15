// Cached per destination and reset immediately before installation.
var
  ProgramFileDecisions: array of Integer;
  ProgramFileRoot: String;
  UnchangedProgramFiles: Integer;
  RequiredProgramFiles: Integer;
  ProgramFileChecksEnabled: Boolean;
  FreshProgramDestination: Boolean;

procedure ResetProgramFileChecks;
begin
  SetArrayLength(ProgramFileDecisions, 0);
  ProgramFileRoot := '';
  UnchangedProgramFiles := 0;
  RequiredProgramFiles := 0;
end;

function NeedProgramFile(Index: Integer; RelativePath: String; ExpectedSize: Integer; ExpectedHash: String): Boolean;
var
  Root: String;
  Filename: String;
  ExistingSize: Integer;
begin
  // Earlier wizard checks must remain cheap. The definitive scan happens once
  // after the directory guard succeeds, immediately before writing any payload.
  if not ProgramFileChecksEnabled then
  begin
    Result := True;
    Exit;
  end;
  Root := AddBackslash(ExpandConstant('{app}'));
  if (ProgramFileRoot <> Root) or (GetArrayLength(ProgramFileDecisions) = 0) then
  begin
    ResetProgramFileChecks;
    ProgramFileRoot := Root;
    SetArrayLength(ProgramFileDecisions, 7035);
  end;
  if ProgramFileDecisions[Index] = 0 then
  begin
    ProgramFileDecisions[Index] := 1;
    Filename := Root + RelativePath;
    if not FreshProgramDestination and FileSize(Filename, ExistingSize) and (ExistingSize = ExpectedSize) then
    begin
      try
        if CompareText(GetSHA256OfFile(Filename), ExpectedHash) = 0 then
          ProgramFileDecisions[Index] := 2;
      except
        // Unreadable, missing or different files follow the normal repair path.
        ProgramFileDecisions[Index] := 1;
      end;
    end;
    if ProgramFileDecisions[Index] = 2 then
      UnchangedProgramFiles := UnchangedProgramFiles + 1
    else
      RequiredProgramFiles := RequiredProgramFiles + 1;
  end;
  Result := ProgramFileDecisions[Index] = 1;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    Log(Format('Fusion file checks: %d unchanged, %d installed/repaired.', [UnchangedProgramFiles, RequiredProgramFiles]));
end;
