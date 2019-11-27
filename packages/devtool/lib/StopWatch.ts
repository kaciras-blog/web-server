/**
 * process.hrtime() 返回的时间二元组的类型，第一个是秒，第二个是纳秒。
 * 这个数组仅用于打包两个数，不应该被修改，所以加上一个 readonly 修饰符。
 */
type SecondAndNano = readonly [number, number];

function offsetMS(from: SecondAndNano, to: SecondAndNano) {
	return (to[0] - from[0]) * 1000 + (to[1] - from[1]) / 1000000;
}

/** 简单的计时器，使用 process.hrtime 高精度时间，可用于测试性能 */
export default class StopWatch {

	private init?: SecondAndNano;
	private last!: SecondAndNano;

	/** 开始计时 */
	start() {
		this.init = this.last = process.hrtime();
	}

	/**
	 * 获取计时时间和离上次调用此方法又过了多久的时间，必须先调用 start()。
	 *
	 * @return [计时时间, 两次time()的时差] 二元组，单位毫秒
	 */
	time(): [number, number] {
		const { init, last } = this;
		if (!init) {
			throw new Error("请先调用 start() 启动计时器");
		}
		const now = this.last = process.hrtime();
		return [offsetMS(init, now), offsetMS(last, now)];
	}
}
