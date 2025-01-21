var storageArea = chrome.storage.local;

function validURL(str) {
	var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
	  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
	  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
	  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
	  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
	  '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
	return !!pattern.test(str);
}

function ReloadRedirections() {
	storageArea.get({
		domain: ""
	}, function(obj) {
		if (validURL(obj.domain)) {
			fetch("https://olympus.pages.dev/").then(response => response.text()).then(data => {
				const url = (/q:id=4 q:key=VpPg:(.*?)(?=\s*-->)/g).exec(data)[1]

				if (obj.domain !== url) {
					storageArea.set({
						domain: url
					});
				} else {
					storageArea.get({
						old_domains : []
					}, async function(obj_) {
						const redirections = []
						
						const url = obj.domain;
						obj_.old_domains.map(old_domain => {
							redirections.push({
								id: (redirections.length + 1),
								priority: 1,
								action: {
									type: "redirect",
									redirect: {
										regexSubstitution: `${url}\\1`
									}
								},
								condition: {
									regexFilter: `^${old_domain}(.*)`,
									resourceTypes: ["main_frame"]
								}
							})
						})
		
						const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
						const oldRuleIds = oldRules.map(rule => rule.id);
		
						await chrome.declarativeNetRequest.updateDynamicRules({
							removeRuleIds: oldRuleIds,
							addRules: redirections
						});
					})
				}
			})
		} else {
			fetch("https://olympus.pages.dev/").then(response => response.text()).then(data => {
				const url = (/q:id=4 q:key=VpPg:(.*?)(?=\s*-->)/g).exec(data)[1]
				
				storageArea.set({
					domain: url
				});
			})
		}
	})
}

chrome.storage.onChanged.addListener(function(changes, namespace) {
	if (changes.domain || changes.old_domains) {
		ReloadRedirections()
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status !== "complete") return

	if (tab.url == "https://olympus.pages.dev/") {
		ReloadRedirections()
	}
});

ReloadRedirections()

chrome.runtime.onInstalled.addListener(async function (){
	const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
	const oldRuleIds = oldRules.map(rule => rule.id);

	await chrome.declarativeNetRequest.updateDynamicRules({
		removeRuleIds: oldRuleIds,
	});

	storageArea.set({
		domain: "https://olympuslectura.com/"
	});
	storageArea.set({
		old_domains: [
			"https://olympuscomic.com/",
			"https://zonaolympus.com/"
		]
	});
});