const template = document.createElement("template");
template.innerHTML = `
	<style>${styles}</style>

	<div id="box">
		<img alt="icon">
		<input
			id="input"
			enterkeyhint="search"
			placeholder="搜索"
		>
		<button
			id="button"
			tabindex="-1"
			title="搜索"
			class="plain"
			type="button"
		>
			${ArrowIcon}
		</button>
	</div>

	<ul id="suggestions"></ul>
`;

/**
 * 搜索框，高仿 Firefox 内置样式，不过不会像它一样傻逼把输入重定向到地址栏。
 *
 * 这里不使用 Search API 因为不支持获取建议。
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/search
 */
class SearchBoxElement extends HTMLElement {

	limit = 8;		// 搜索建议最大显示数量
	api;			// 当前的搜索引擎，是 engine 属性的内部字段
	waitIME = true;	// 使用输入法时，防止建议未上屏的字符

	index = null;	// 被选中建议的索引

	constructor() {
		super();
		const root = this.attachShadow({ mode: "closed", delegatesFocus: true });
		root.append(template.content.cloneNode(true));

		this.inputEl = root.getElementById("input");
		this.iconEl = root.querySelector("img");
		this.boxEl = root.getElementById("box");
		this.suggestionEl = root.getElementById("suggestions");

		this.fetcher = new DebounceThrottle(this.suggest.bind(this));
		this.fetcher.threshold = 500;

		this.inputEl.onkeydown = this.handleInputKeyDown.bind(this);
		this.inputEl.oninput = this.handleInput.bind(this);
		root.addEventListener("keydown", this.handleKeyDown.bind(this));
		root.getElementById("button").onclick = this.handleSearchClick.bind(this);
	}

	get engine() {
		return this.api;
	}

	/**
	 * 更改使用的搜索引擎，该项无默认值必须自己设置。
	 *
	 * 注意：对于已经显示的建议列表，切换引擎不会刷新建议。
	 *
	 * @param value 新的搜索引擎
	 */
	set engine(value) {
		this.api = value;
		this.iconEl.src = value.favicon;
	}

	get searchTerms() {
		return this.inputEl.value;
	}

	set searchTerms(value) {
		this.inputEl.value = value;
	}

	get threshold() {
		return this.fetcher.threshold;
	}

	set threshold(value) {
		this.fetcher.threshold = value;
	}

	/*
	 * 对获取建议的中断分为两个阶段，先是防抖，一旦开始请求则不再受防抖的影响，
	 * 只有下一次的请求才能中断前面的。
	 * 这样的设计使得输入中途也能显示建议，并尽可能地减少了请求，与其他平台一致。
	 *
	 * 【其它实现】
	 * 若把判断逻辑全部放入回调，代码会更简单一些，但为空时的关闭过程也会被延迟。
	 */
	handleInput(event) {
		if (this.waitIME && event.isComposing) {
			return;
		}
		if (this.searchTerms) {
			this.fetcher.reschedule();
		} else {
			this.fetcher.stop();
			this.index = null;
			this.boxEl.classList.remove("suggested");
		}
	}

	/**
	 * 从搜索引擎查询当前搜索词的建议，然后更新建议菜单。
	 * 该方法只能同时运行一个，每次调用都会取消上一次的。
	 */
	async suggest(signal) {
		const { api, searchTerms } = this;
		try {
			const list = await api.suggest(searchTerms, signal);
			this.setSuggestions(list);
		} catch (e) {
			if (e.name !== "AbortError") console.error(e);
		}
	}

	setSuggestions(list) {
		const count = Math.min(this.limit, list.length);
		const newItems = new Array(count);

		for (let i = 0; i < count; i++) {
			const text = list[i];

			const el = newItems[i] = document.createElement("li");
			el.textContent = text;
			el.onclick = () => location.href = this.api.getResultURL(text);
		}

		this.suggestionEl.replaceChildren(...newItems);
		this.boxEl.classList.toggle("suggested", count > 0);
	}

	/**
	 * 按回车键跳转到搜索页面，同时处理了输入法的问题。
	 *
	 * 由于 compositionend 先于 KeyUp 所以只能用 KeyDown 确保能获取输入状态。
	 * Google 的搜索页面也是在 KeyDown 阶段就触发。
	 */
	handleInputKeyDown(event) {
		if (event.key !== "Enter") {
			return;
		}
		if (this.waitIME && event.isComposing) {
			return;
		}
		event.stopPropagation();
		location.href = this.api.getResultURL(this.searchTerms);
	}

	// click 只由左键触发，无需检查 event.button
	handleSearchClick() {
		location.href = this.api.getResultURL(this.searchTerms);
	}

	handleKeyDown(event) {
		let diff;

		switch (event.key) {
			case "ArrowDown":
				diff = 1;
				break;
			case "ArrowUp":
				diff = -1;
				break;
			case "Escape":
				return this.blur();
			default:
				return;
		}

		event.preventDefault();
		const { children } = this.suggestionEl;
		const { index } = this;
		const { length } = children;

		if (index !== null) {
			children[index].classList.remove("active");
			this.index = (index + diff + length) % length;
		} else {
			this.index = diff > 0 ? 0 : length - 1;
		}

		children[this.index].classList.add("active");
		this.searchTerms = children[this.index].textContent;
	}
}

customElements.define("search-box", SearchBoxElement);
