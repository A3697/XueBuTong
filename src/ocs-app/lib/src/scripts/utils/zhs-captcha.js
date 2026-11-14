'use strict';
// Ported from OCS Desktop v3.9.1 (MIT): automation/wk/zhs.ts.
// The verification functions below retain the official implementation.
const axios=require('axios');
const {getBase64,handleOcrMissing,visualClick}=require('./modern');
const PIECE_PAD=4;

async function loopVerify(
	page      ,
	opts
) {
	let count = 5;
	while (await isNotVerified(page)) {
		if (count > 0) {
			count--;
			// 滑块弹窗未弹出（或已被关闭）时，重新点击登录按钮触发验证码
			if (!(await isYidunPopupVisible(page))) {
				await visualClick(page, '.btn-block__grandient_login');
				await page.waitForTimeout(1000);
			}
			await verify(page, opts);
			await page.waitForTimeout(2000);
		} else {
			throw new Error('滑块识别失败，请手动登录。');
		}
	}
}

async function isYidunPopupVisible(page      ) {
	return page.evaluate(() => {
		const el = document.querySelector('.yidun_popup')               ;
		return !!el && !!(el.offsetWidth || el.offsetHeight);
	});
}

async function verify(
	page      ,
	opts
) {
	// 删除yidun遮挡
	await page.evaluate(() =>
		document.querySelectorAll('.yidun_cover-frame,.yidun_popup__mask').forEach((el) => el.remove())
	);

	const det_slider_el = await page.$('.yidun_slider');
	const det_target_el = await page.$('[alt="验证码滑块"]');
	const det_bg_el = await page.$('[alt="验证码背景"]');

	if (!det_target_el || !det_slider_el || !det_bg_el) {
		return;
	}

	const det_target_src = await det_target_el.getAttribute('src');
	const det_bg_src = await det_bg_el.getAttribute('src');
	if (!det_target_src || !det_bg_src) {
		return;
	}

	// 调用本地 ddddocr 识别缺口
	const body = Object.create({});
	Reflect.set(body, opts.detTargetKey, await getBase64(det_target_src));
	Reflect.set(body, opts.detBackgroundKey, await getBase64(det_bg_src));
	const { data } = await axios.post(opts.ocrApiUrl, body);
	console.log('slider ocr', JSON.stringify(data));

	if (data?.error) {
		// error 可能来自服务端序列化后的原始对象，统一转为可读消息
		const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
		throw new Error(msg);
	}
	if (!data?.canOCR) {
		// 手动模式：提示人工干预并跳过（等待用户手动完成），不再报错
		if (handleOcrMissing(opts)) return;
		throw new Error('未检测到图片验证码识别模块, 请手动输入验证码，或在软件左侧应用中心安装识别模块后重启浏览器。。');
	}
	const targetX = Number(data?.det?.target?.[0]);
	if (!Number.isFinite(targetX)) {
		throw new Error('滑块验证识别失败，请尝试手动登录。');
	}

	// 背景图/拼图几何：计算渲染缩放，目标为「渲染像素」（相对背景图左缘）
	const bgGeom = await det_bg_el.evaluate((node) => {
		const b = node                    ;
		const r = b.getBoundingClientRect();
		return { naturalW: b.naturalWidth || r.width, displayW: r.width };
	});
	const pzGeom = await det_target_el.evaluate((node) => {
		const b = node                    ;
		const r = b.getBoundingClientRect();
		return { naturalW: b.naturalWidth || r.width, displayW: r.width };
	});
	const bgScale = bgGeom.displayW / bgGeom.naturalW || 1;
	const pzScale = pzGeom.displayW / pzGeom.naturalW || 1;
	// ddddocr 的 target[0] 是背景图自然像素坐标，乘 bgScale 得缺口渲染位置；
	// 拼图图形在 img 内有 PIECE_PAD 左边距（自然像素），需乘 pzScale 扣除
	const targetPieceLeft = targetX * bgScale - PIECE_PAD * pzScale;

	// 滑块按钮起点与行程上限（轨道宽 - 滑块宽，随分辨率动态变化）
	const handleRect = await det_slider_el.evaluate((node) => {
		const r = (node               ).getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
	});
	const controlW = await page.evaluate(() => {
		const el = document.querySelector('.yidun_control')                      ;
		return el ? el.getBoundingClientRect().width : 0;
	});
	const maxSlider = Math.max(0, controlW - handleRect.w) || 200;

	// 闭环伺服拖动：以拼图实际渲染位移为反馈逐步逼近，不依赖联动比例，兼容任意分辨率/缩放
	await servoDrag(page, handleRect.x, handleRect.y, targetPieceLeft, maxSlider);

	try {
		await page.waitForNavigation({ timeout: 3000, waitUntil: 'domcontentloaded' });
	} catch {}
}

async function servoDrag(page      , sx        , sy        , targetPieceLeft        , maxSlider        ) {
	await page.mouse.move(sx, sy);
	await page.mouse.down();
	// 等待易盾联动生效，读取拼图初始渲染位移
	await page.waitForTimeout(70);
	let sliderLeft = 0;
	let pieceLeft = await readPieceRenderLeft(page);
	let lastResidual = Number.NaN;
	let stuck = 0;
	for (let i = 0; i < 60; i++) {
		const residual = targetPieceLeft - pieceLeft;
		if (Math.abs(residual) <= 2) {
			break;
		}
		if (sliderLeft >= maxSlider) {
			break;
		}
		// 反馈无变化（联动卡住）连续多次时放弃本次拖动
		if (Math.abs(residual - lastResidual) < 0.01) {
			if (++stuck > 4) {
				break;
			}
		} else {
			stuck = 0;
		}
		// 先粗后细：残差大走大步、逼近后走小步
		const step = Math.abs(residual) > 40 ? 10 : Math.abs(residual) > 12 ? 5 : 2;
		const next = Math.min(maxSlider, Math.max(0, sliderLeft + Math.sign(residual) * step));
		if (next === sliderLeft) {
			break;
		}
		sliderLeft = next;
		// 轻微纵向抖动，防行为检测
		await page.mouse.move(sx + sliderLeft, sy + Math.sin(i * 0.8));
		await page.waitForTimeout(70);
		pieceLeft = await readPieceRenderLeft(page);
		lastResidual = residual;
	}
	await page.mouse.up();
}

async function readPieceRenderLeft(page      ) {
	return page.evaluate(() => {
		const jig = document.querySelector('[alt="验证码滑块"]')                      ;
		const bg = document.querySelector('[alt="验证码背景"]')                      ;
		if (!jig || !bg) {
			return 0;
		}
		return jig.getBoundingClientRect().left - bg.getBoundingClientRect().left;
	});
}

async function isNotVerified(page      ) {
	await page.waitForTimeout(2000);

	const errors = await page.evaluate(() =>
		Array.from(document.querySelectorAll('.el-form-item__error, .el-message__content'))
			.map((e) => e.textContent || '')
			// 过滤登录成功等提示
			.filter((text) => text && !text.includes('成功'))
	);

	if (errors.length) {
		throw new Error(errors.join('\n'));
	}

	return page.url().includes('login.zhihuishu.com');
}
module.exports={loopVerify,verify};
