/*!
 * Live2D Widget
 * https://github.com/stevenjoezhang/live2d-widget
 */
// Use local self-hosted path (served from /live2d/ via Next.js public dir)
const live2d_path = '/live2d/';
// Method to encapsulate asynchronous resource loading
function loadExternalResource(url, type) {
	return new Promise((resolve, reject) => {
		let tag;
		if (type === 'css') {
			tag = document.createElement('link');
			tag.rel = 'stylesheet';
			tag.href = url;
		} else if (type === 'js') {
			tag = document.createElement('script');
			tag.type = 'module';
			tag.src = url;
		}
		if (tag) {
			tag.onload = () => resolve(url);
			tag.onerror = () => reject(url);
			document.head.appendChild(tag);
		}
	});
}
(async () => {
	// Avoid cross-origin issues with image resources
	const OriginalImage = window.Image;
	window.Image = function(...args) {
		const img = new OriginalImage(...args);
		img.crossOrigin = "anonymous";
		return img;
	};
	window.Image.prototype = OriginalImage.prototype;
	// Load waifu.css and waifu-tips.js
	await Promise.all([
		loadExternalResource(live2d_path + 'waifu.css', 'css'),
		loadExternalResource(live2d_path + 'waifu-tips.js', 'js')
	]);
	initWidget({
		waifuPath: live2d_path + 'waifu-tips.json',
		// Default to a model with multiple outfits (see waifu-tips.json order).
		// localStorage modelId overrides this after the first visit.
		modelId: 0,
		modelTexturesId: 0,
		cubism2Path: live2d_path + 'live2d.min.js',
		cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
		// hitokoto / asteroids call third-party APIs (v1.hitokoto.cn, extra scripts).
		// They throw "Failed to fetch" under strict CSP, CORP, or CN network blocks.
		// Site chat is AstrBot — keep model/outfit/photo/info/quit only.
		tools: ['switch-model', 'switch-texture', 'photo', 'info', 'quit'],
		logLevel: 'warn',
		drag: false,
	});
})();
console.log(`\n%cLive2D%cWidget%c\n`, 'padding: 8px; background: #cd3e45; font-weight: bold; font-size: large; color: white;', 'padding: 8px; background: #ff5450; font-size: large; color: #eee;', '');
