'use strict';
// Adapted from OCS Desktop v3.9.1 (MIT). Existing login flows use their original helpers.
const {getBase64}=require('./index');
async function visualClick(page              , selector        , opts                               ) {
	try {
		const el = await page.waitForSelector(selector, { timeout: opts?.timeout ?? 3000 });
		if (el) {
			await el.scrollIntoViewIfNeeded().catch(() => {});
			const box = await el.boundingBox();
			if (box) {
				await page
					.evaluate(
						({ x, y }) => {
							// evaluate 回调被序列化到页面执行，无法引用模块作用域，样式内联
							const ripple = document.createElement('div');
							/* eslint-disable max-len */
							ripple.style.cssText = `position:fixed;left:${x - 22}px;top:${
								y - 22
							}px;width:44px;height:44px;border-radius:50%;border:3px solid #ff5722;background:rgba(255,87,34,0.28);z-index:2147483647;pointer-events:none;transform:scale(0.3);transition:transform 0.45s ease-out,opacity 0.55s ease-out;`;
							/* eslint-enable max-len */
							(document.body || document.documentElement).appendChild(ripple);
							// 强制 reflow 触发过渡动画：后台标签页 rAF 被节流（自动化页面常非活动标签），
							// 读取布局属性强制回流后改样式，transition 不依赖 rAF
							ripple.getBoundingClientRect();
							ripple.style.transform = 'scale(1.5)';
							ripple.style.opacity = '0';
							setTimeout(() => ripple.remove(), 700);
						},
						{ x: box.x + box.width / 2, y: box.y + box.height / 2 }
					)
					.catch(() => {});
				// 圆圈动画展示片刻再真实点击，避免一闪而过
				await page.waitForTimeout(350);
			}
		}
	} catch {}
	await page.click(selector, opts);
}
function handleOcrMissing(opts                 )          {
	if (opts.ocrManual) {
		opts.onManualCaptcha?.();
		return true;
	}
	return false;
}
async function ensureWideViewport(page      , minCssW = 1280, minCssH = 720)                {
	// 真实窗口的 viewportSize() 为 null（视口跟随窗口）；仅在上下文显式设置了 viewport 时才可 setViewportSize
	const cur = page.viewportSize();
	if (cur?.width) {
		if (cur.width >= minCssW) return;
		try {
			await page.setViewportSize({ width: minCssW, height: Math.max(cur.height, minCssH) });
			await page.waitForTimeout(150);
		} catch {
			// setViewportSize 不支持时（如 viewport:null 窗口）回退到下面 CDP 调整窗口
		}
		return;
	}

	// 有头真实窗口：用 CDP 调整窗口 bounds（单位为 DIP，与页面 CSS 像素一致）
	let cdp;
	try {
		cdp = await page.context().newCDPSession(page);
		// Browser.getWindowForTarget 不传 targetId 时作用于当前 CDP session 所在 target
		const { windowId } = await cdp.send('Browser.getWindowForTarget');
		const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
		const bw = bounds?.width || 0;
		const bh = bounds?.height || 0;
		if (bw >= minCssW) return;
		const avail = await page.evaluate(() => ({ w: screen.availWidth, h: screen.availHeight }));
		const nextW = Math.min(minCssW, avail.w);
		const nextH = Math.max(bh, Math.min(minCssH, avail.h));
		if (nextW <= bw && nextH <= bh) return;
		await cdp.send('Browser.setWindowBounds', {
			windowId,
			bounds: { ...bounds, width: nextW, height: nextH, windowState: 'normal' }
		});
		await page.waitForTimeout(200);
	} catch {
		// 无 CDP 权限时静默跳过，交由后续交互兜底
	} finally {
		await cdp?.detach().catch(() => {});
	}
}
module.exports={visualClick,handleOcrMissing,ensureWideViewport,getBase64};
