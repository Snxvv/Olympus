function dataBind(el, dataObject) {
	function boolValue(prop) {
		return prop.charAt(0) === '!' ? !dataObject[prop.substr(1)] : dataObject[prop];
	}

    if (typeof el === 'string') {
		el = document.querySelector(el)
	}
	for (let tag of el.querySelectorAll('[data-bind]')) {
		let prop = tag.getAttribute('data-bind');

		tag.textContent = dataObject[prop];
	}
	for (let tag of el.querySelectorAll('[data-show]')) {
		let shouldShow = boolValue(tag.getAttribute('data-show'));
		
		tag.style.display = shouldShow ? '' : 'none';
	}
}

function el(query) {
	return document.querySelector(query);
}