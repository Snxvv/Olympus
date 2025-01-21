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

	let checkmark = node.querySelectorAll('.checkmark');

	if(checkmark.length == 1) {
		checkmark[0].setAttribute('data-index', index);
	}

	delete redirect.$first;
	delete redirect.$last;
	delete redirect.$index;
}

function pageLoad() {
	template = el('#redirect-row-template');
	template.parentNode.removeChild(template);

	//Need to proxy this through the background page, because Firefox gives us dead objects
	//nonsense when accessing chrome.storage directly.
	chrome.runtime.sendMessage({type: "get-redirects"}, async function(response) {
		console.log('Received redirects message, count=' + response.redirects.length);
		for (var i=0; i < response.redirects.length; i++) {
			var existingRedirectIndex = REDIRECTS.findIndex(r => r.exampleUrl === response.redirects[i].exampleUrl);
			
			if (existingRedirectIndex === -1) {
			  console.log('Adding redirect: ' + response.redirects[i].exampleUrl)
			  REDIRECTS.push(new Redirect(response.redirects[i]));
			} else {
				if (REDIRECTS[existingRedirectIndex].exampleResult !== response.redirects[i].exampleResult) {
					REDIRECTS[existingRedirectIndex] = new Redirect(response.redirects[i]);
					console.log('Updating redirect: ' + response.redirects[i].exampleUrl)
				} else {
					console.log('Already added: ' + response.redirects[i].exampleUrl)
				}
			}
		}
		renderRedirects();
	});
}

pageLoad();