var REDIRECTS = [];
var template;

function renderRedirects() {
	el('.redirect-rows').textContent = '';
	for (let i=0; i < REDIRECTS.length; i++) {
		let r = REDIRECTS[i];
		let node = template.cloneNode(true);
		node.removeAttribute('id');

		renderSingleRedirect(node, r, i);
		el('.redirect-rows').appendChild(node);
	}
}

function renderSingleRedirect(node, redirect, index) {
	if (index === 0) {
		redirect.$first = true;
	}
	if (index === REDIRECTS.length - 1) {
		redirect.$last = true;
	}
	redirect.$index = index;

	dataBind(node, redirect);

	node.setAttribute('data-index', index);
	for (let btn of node.querySelectorAll('.btn')) {
		btn.setAttribute('data-index', index);
	}

	delete redirect.$first;
	delete redirect.$last;
	delete redirect.$index;
}

async function pageLoad() {
	template = el('#redirect-row-template');
	template.parentNode.removeChild(template);

	const redirects = await chrome.declarativeNetRequest.getDynamicRules()
	
	console.log('Received redirects message, count=' + redirects.length);
	redirects.map(r => {
		REDIRECTS.push({
			Url: r.condition.regexFilter.replace(/^\^|\(.*\)$/g, ""),
			Response: r.action.redirect.regexSubstitution.replace(/\\1$/, "")
		});

		renderRedirects();
	})
}

pageLoad();