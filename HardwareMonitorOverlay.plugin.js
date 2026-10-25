/**
 * @name HardwareMonitorOverlay
 * @author M00RTEN
 * @authorLink https://github.com/M00RTEN
 * @version 2.3.0
 * @description Viser CPU/GPU/RAM-data fra LibreHardwareMonitor i Discord-menyen (under Meldingsforespørsler i DM, og under servernavn på servere).
 * @source https://github.com/M00RTEN/discord-hw-monitor
 * @updateUrl https://raw.githubusercontent.com/M00RTEN/discord-hw-monitor/main/HardwareMonitorOverlay.plugin.js
 * @invite gBctYMD3fd
 */

module.exports = (() => {
	const DATA_URL = "http://localhost:8085/data.json";
	const UPDATE_MS = 2000;

	// Kalibrering av RAM i prosentpoeng. LibreHardwareMonitor regner ut RAM-bruk
	// annerledes enn Oppgavebehandling. Juster til tallet matcher (0 = ingen justering).
	const RAM_OFFSET = -10;

	var widgetElement = null;
	var updateInterval = null;
	var observer = null;
	var fetching = false;

	return class HardwareMonitorOverlay {
		start () {
			this.createWidget();
			this.startMonitoring();
			this.initObserver();
		}

		stop () {
			if (updateInterval) clearInterval(updateInterval);
			if (observer) observer.disconnect();
			updateInterval = null;
			observer = null;
			this.removeWidget();
		}

		createWidget () {
			if (widgetElement) return;

			widgetElement = document.createElement("div");
			widgetElement.id = "m00rten-hw-native-widget";
			widgetElement.innerHTML = `
				<div class="hw-header">HW Monitor</div>
				<div class="hw-row"><span class="hw-label">CPU</span> <span class="hw-value" id="hw-cpu">--</span></div>
				<div class="hw-row"><span class="hw-label">GPU</span> <span class="hw-value" id="hw-gpu">--</span></div>
				<div class="hw-row"><span class="hw-label">RAM</span> <span class="hw-value" id="hw-ram">--</span></div>
			`;

			widgetElement.style.cssText = `
				background: var(--background-secondary, #2f3136);
				color: var(--header-secondary, #b9bbbe);
				padding: 8px 12px;
				margin: 6px 8px;
				border-radius: 4px;
				font-size: 11px;
				font-family: var(--font-primary, sans-serif);
				box-sizing: border-box;
			`;

			if (!document.getElementById("m00rten-hw-native-style")) {
				let style = document.createElement("style");
				style.id = "m00rten-hw-native-style";
				style.innerHTML = `
					#m00rten-hw-native-widget .hw-header { font-weight: 700; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 2px; color: var(--header-primary, #fff); text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
					#m00rten-hw-native-widget .hw-row { display: flex; justify-content: space-between; margin-top: 3px; color: var(--text-normal, #dcddde); }
					#m00rten-hw-native-widget .hw-label { font-weight: 600; }
				`;
				document.head.appendChild(style);
			}

			this.placeWidget();
		}

		isDMView () {
			return location.pathname.startsWith("/channels/@me") || location.pathname.startsWith("/message-requests");
		}

		getAnchor () {
			if (this.isDMView()) {
				let link = document.querySelector('a[href="/message-requests"]');
				if (link) return link.closest("li") || link.parentElement;

				let friends = document.querySelector('a[href="/channels/@me"]');
				if (friends) return friends.closest("li") || friends.parentElement;

				return null;
			}

			let header = document.querySelector('[class*="sidebar"] [class*="header_"]');
			return header && header.offsetParent !== null ? header : null;
		}

		placeWidget () {
			if (!widgetElement) return;
			let anchor = this.getAnchor();
			if (!anchor) return;
			if (anchor.nextElementSibling === widgetElement) return;
			anchor.insertAdjacentElement("afterend", widgetElement);
		}

		initObserver () {
			let queued = false;
			observer = new MutationObserver(() => {
				if (queued) return;
				queued = true;
				requestAnimationFrame(() => {
					queued = false;
					this.placeWidget();
				});
			});
			observer.observe(document.body, { childList: true, subtree: true });
		}

		removeWidget () {
			if (widgetElement) {
				widgetElement.remove();
				widgetElement = null;
			}
			let style = document.getElementById("m00rten-hw-native-style");
			if (style) style.remove();
		}

		normalizeType (str) {
			let s = String(str || "").toLowerCase().replace(/^.*\//, "").replace(/\.\w+$/, "").trim();
			if (s.length > 4 && s.endsWith("s")) s = s.slice(0, -1);
			return s;
		}

		parseValue (str, type) {
			if (typeof str === "number") return str;
			if (typeof str !== "string") return null;
			let m = str.replace(",", ".").match(/-?\d+(\.\d+)?/);
			if (!m) return null;
			let value = parseFloat(m[0]);
			if (type === "temperature" && /°\s*F/i.test(str)) value = (value - 32) * 5 / 9;
			return value;
		}

		flatten (node, ancestors, out) {
			if (!node) return;
			let hasChildren = Array.isArray(node.Children) && node.Children.length > 0;
			if (hasChildren) {
				let next = ancestors.concat(node);
				node.Children.forEach(child => this.flatten(child, next, out));
				return;
			}

			let sid = String(node.SensorId || "");
			let sidParts = sid.split("/");
			let group = ancestors[ancestors.length - 1] || null;
			let type = this.normalizeType(node.Type)
				|| this.normalizeType(sidParts.length > 2 ? sidParts[sidParts.length - 2] : "")
				|| this.normalizeType(group && group.ImageURL)
				|| this.normalizeType(group && group.Text);

			let value = this.parseValue(node.Value, type);
			if (value === null) return;

			out.push({
				name: node.Text || "",
				type: type,
				value: value,
				sid: sid.toLowerCase(),
				hardware: ancestors[2] || null
			});
		}

		classify (sensor) {
			let hw = sensor.hardware;
			if (!hw) return null;

			if (sensor.sid) {
				if (/^\/(amdcpu|intelcpu)\//.test(sensor.sid)) return "cpu";
				if (/^\/(gpu-|atigpu|nvidiagpu)/.test(sensor.sid)) return "gpu";
				if (/^\/ram\//.test(sensor.sid)) return "ram";
			}

			let text = (hw.Text || "").toLowerCase();
			let image = (hw.ImageURL || "").toLowerCase().replace(/^.*\//, "").replace(/\.\w+$/, "");

			if (/^(nvidia|ati|gpu)/.test(image) || /radeon|geforce|nvidia|\brtx\b|\bgtx\b|\barc\b|\bgpu\b|graphics/.test(text)) return "gpu";
			if (image === "cpu" || /ryzen|intel.*core|core i\d|xeon|threadripper|\bcpu\b/.test(text)) return "cpu";
			if (image === "ram" || /memory/.test(text)) return "ram";
			return null;
		}

		isIntegrated (sensor) {
			let text = (sensor.hardware && sensor.hardware.Text || "").trim();
			if (/integrated/.test(sensor.sid)) return true;
			if (/^(amd\s+)?radeon\s*(\(tm\))?\s*graphics$/i.test(text)) return true;
			if (/intel.*(uhd|iris|hd)\s.*graphics/i.test(text)) return true;
			return false;
		}

		extract (data) {
			let sensors = [];
			this.flatten(data, [], sensors);

			let groups = new Map();
			sensors.forEach(s => {
				let kind = this.classify(s);
				if (!kind) return;
				s.kind = kind;
				if (!groups.has(s.hardware)) groups.set(s.hardware, []);
				groups.get(s.hardware).push(s);
			});

			let best = kind => {
				let bestList = null;
				let bestScore = -Infinity;
				groups.forEach(list => {
					if (list[0].kind !== kind) return;
					let score = list.length;
					if (list.some(s => s.type === "temperature")) score += 50;
					if (this.isIntegrated(list[0])) score -= 1000;
					if (score > bestScore) {
						bestScore = score;
						bestList = list;
					}
				});
				return bestList;
			};

			let pick = (list, preferred) => {
				for (let re of preferred) {
					let found = list.find(s => re.test(s.name));
					if (found) return found;
				}
				return list[0] || null;
			};

			let result = {
				cpu: { name: null, temp: null, load: null },
				gpu: { name: null, temp: null, load: null },
				ram: { name: null, load: null }
			};

			let prefs = {
				cpu: {
					temp: [/tctl|tdie/i, /package/i, /^cpu$/i, /core/i],
					load: [/cpu total/i, /total/i]
				},
				gpu: {
					temp: [/^gpu core$/i, /gpu core/i, /gpu/i, /core/i],
					load: [/^gpu core$/i, /gpu core/i, /gpu/i, /core/i]
				}
			};

			["cpu", "gpu"].forEach(kind => {
				let list = best(kind);
				if (!list) return;
				result[kind].name = list[0].hardware.Text;

				let temps = list.filter(s => s.type === "temperature" && !/distance|tjmax/i.test(s.name));
				let t = pick(temps, prefs[kind].temp);
				if (t) result[kind].temp = t.value;

				let loads = list.filter(s => s.type === "load");
				let l = pick(loads, prefs[kind].load);
				if (l) result[kind].load = l.value;
			});

			let ramSensors = sensors.filter(s => this.classify(s) === "ram" && s.type === "load");
			let ram = ramSensors.find(s => /^memory$/i.test(s.name)) || ramSensors.find(s => /memory/i.test(s.name) && !/virtual/i.test(s.name));
			if (ram) {
				result.ram.load = Math.max(0, Math.min(100, ram.value + RAM_OFFSET));
				result.ram.name = ram.hardware.Text;
			}

			return result;
		}

		async fetchData () {
			let fetcher = (BdApi.Net && BdApi.Net.fetch) ? BdApi.Net.fetch.bind(BdApi.Net) : window.fetch.bind(window);
			let response = await fetcher(DATA_URL, { cache: "no-store" });
			if (!response || !response.ok) throw new Error("HTTP " + (response && response.status));
			return await response.json();
		}

		setRow (id, text, title) {
			let el = document.getElementById(id);
			if (!el) return;
			el.innerText = text;
			el.parentElement.title = title || "";
		}

		fmt (temp, load) {
			let parts = [];
			if (temp !== null && temp !== undefined) parts.push(Math.round(temp) + "°C");
			if (load !== null && load !== undefined) parts.push(Math.round(load) + "%");
			return parts.length ? parts.join(" · ") : "--";
		}

		async update () {
			if (fetching || !document.getElementById("hw-cpu")) return;
			fetching = true;
			try {
				let data = await this.fetchData();
				let r = this.extract(data);
				this.setRow("hw-cpu", this.fmt(r.cpu.temp, r.cpu.load), r.cpu.name);
				this.setRow("hw-gpu", this.fmt(r.gpu.temp, r.gpu.load), r.gpu.name);
				this.setRow("hw-ram", this.fmt(null, r.ram.load), r.ram.name);
			} catch (e) {
				this.setRow("hw-cpu", "Ingen data");
				this.setRow("hw-gpu", "Ingen data");
				this.setRow("hw-ram", "Ingen data", "Kunne ikke nå " + DATA_URL + ". Kjører LibreHardwareMonitor med Remote Web Server på?");
			} finally {
				fetching = false;
			}
		}

		startMonitoring () {
			this.update();
			updateInterval = setInterval(() => this.update(), UPDATE_MS);
		}
	};
})();
