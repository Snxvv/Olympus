function log(msg) {
	console.log('Olympus Scan: ' + msg);
}

var storageArea = chrome.storage.local;
var partitionedRedirects = {};
var ignoreNextRequest = {};
var justRedirected = {};
var redirectThreshold = 3;

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
		if (obj.domain.length > 0) {
			storageArea.get({
				old_domains : []
			}, function(obj_) {
				const redirects = []

				obj_.old_domains.map(old_domain => {
					redirects.push(new Redirect({
						description: "",
						exampleUrl: `${old_domain}#`,
						exampleResult: `${obj.domain}#`,
						error: null,
						includePattern: `${old_domain}*`,
						excludePattern: "",
						patternDesc: "",
						redirectUrl: `${obj.domain}$1`,
						patternType: "W",
						processMatches: "noProcessing",
						disabled: false,
						appliesTo: [
							"main_frame"
						]
					}).toObject())
				})

				storageArea.set({
					redirects: redirects
				})
			})
		}
	})
}

function checkRedirects(details) {
	if (details.method != 'GET') {
		return {};
	}
	log('Checking: ' + details.type + ': ' + details.url);
	if (details.url == "https://olympus.pages.dev/") {
		storageArea.get({
			domain: ""
		}, async function(obj) {
			if (obj.domain.length > 0) {
				fetch(details.url).then(response => response.text()).then(data => {
					const url = (/q:id=4 q:key=VpPg:(.*?)(?=\s*-->)/g).exec(data)[1]
					if (obj.domain !== url) {
						log("Updating domain...")
						storageArea.set({
							domain: url
						});
						log("Domain updated!!")
						if (validURL(obj.domain)) {
							storageArea.get({
								old_domains : []
							}, function(obj_) {
								var old_domains = obj_.old_domains
								if (!old_domains.includes(obj.domain)) {
									log("Adding old domain to redirect list...")
									old_domains.push(obj.domain)
									storageArea.set({
										old_domains: old_domains
									});
									log("Old domain redirection added!!")
								}
							})
						}
					}
				})
			} else {
				log("Adding new domain...")
				await fetch(details.url).then(response => response.text()).then(data => {
					const url = (/q:id=4 q:key=VpPg:(.*?)(?=\s*-->)/g).exec(data)[1]
					storageArea.set({
						domain: url
					});
				})
				log("Domain added!!")
			}
		});
	}

	var list = partitionedRedirects[details.type];
	if (!list) {
		log('No list for type: ' + details.type);
		return {};
	}

	var timestamp = ignoreNextRequest[details.url];
	if (timestamp) {
		log('Ignoring ' + details.url + ', was just redirected ' + (new Date().getTime()-timestamp) + 'ms ago');
		delete ignoreNextRequest[details.url];
		return {};
	}

	
	for (var i = 0; i < list.length; i++) {
		var r = list[i];
		var result = r.getMatch(details.url);

		if (result.isMatch) {

			//Check if we're stuck in a loop where we keep redirecting this, in that
			//case ignore!
			var data = justRedirected[details.url];

			var threshold = 3000;
			if(!data || ((new Date().getTime()-data.timestamp) > threshold)) { //Obsolete after 3 seconds
				justRedirected[details.url] = { timestamp : new Date().getTime(), count: 1};
			} else {
				data.count++;
				justRedirected[details.url] = data;
				if (data.count >= redirectThreshold) {
					log('Ignoring ' + details.url + ' because we have redirected it ' + data.count + ' times in the last ' + threshold + 'ms');
					return {};
				} 
			}


			log('Redirecting ' + details.url + ' ===> ' + result.redirectTo + ', type: ' + details.type + ', pattern: ' + r.includePattern + ' which is in Rule : ' + r.description);
			
			ignoreNextRequest[result.redirectTo] = new Date().getTime();
			
			return { redirectUrl: result.redirectTo };
		}
	}

  	return {}; 
}

chrome.storage.onChanged.addListener(function(changes, namespace) {
	if (changes.domain) {
		ReloadRedirections()
    }
	if (changes.old_domains) {
		ReloadRedirections()
	}
	setUpRedirectListener()
});

function createFilter(redirects) {
	var types = [];
	for (var i = 0; i < redirects.length; i++) {
		redirects[i].appliesTo.forEach(function(type) { 
			if(chrome.webRequest.ResourceType[type.toUpperCase()]!== undefined){
			if (types.indexOf(type) == -1) {
				types.push(type);
			}
		}
		});
	}
	types.sort();

	return {
		urls: ["https://*/*", "http://*/*"],
		types : types
	};
}

function createPartitionedRedirects(redirects) {
	var partitioned = {};

	for (var i = 0; i < redirects.length; i++) {
		var redirect = new Redirect(redirects[i]);
		redirect.compile();
		for (var j=0; j<redirect.appliesTo.length;j++) {
			var requestType = redirect.appliesTo[j];
			if (partitioned[requestType]) {
				partitioned[requestType].push(redirect); 
			} else {
				partitioned[requestType] = [redirect];
			}
		}
	}
	return partitioned;	
}

async function setUpRedirectListener() {
	chrome.webRequest.onBeforeRequest.removeListener(checkRedirects);
	chrome.webNavigation.onHistoryStateUpdated.removeListener(checkHistoryStateRedirects);
	
	storageArea.get({
		redirects: []
	}, function(obj) {
		redirects = obj.redirects

		if (redirects.length == 0) {
			log('No redirects defined, not setting up listener');
			return;
		}

		partitionedRedirects = createPartitionedRedirects(redirects);
		var filter = createFilter(redirects);

		log('Setting filter for listener: ' + JSON.stringify(filter));
		chrome.webRequest.onBeforeRequest.addListener(checkRedirects, filter, ["blocking"]);

		if (partitionedRedirects.history) {
			log('Adding HistoryState Listener');

			let filter = { url : []};
			for (let r of partitionedRedirects.history) {
				filter.url.push({urlMatches: r._preparePattern(r.includePattern)});
			}
			chrome.webNavigation.onHistoryStateUpdated.addListener(checkHistoryStateRedirects, filter);
		}
	})
}

function checkHistoryStateRedirects(ev) {
	ev.type = 'history';
	ev.method = 'GET';
	let result = checkRedirects(ev);
	if (result.redirectUrl) {
		chrome.tabs.update(ev.tabId, {url: result.redirectUrl});
	}
}

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		log('Received background message: ' + JSON.stringify(request));
		if (request.type == 'get-redirects') {
			log('Getting redirects from storage');
			
			storageArea.get({
				redirects: []
			}, function(obj) {
				log('Got redirects from storage: ' + JSON.stringify(obj.redirects));
		
				sendResponse(obj);
				
				log('Sent redirects to content page');
			})
		} else {
			log('Unexpected message: ' + JSON.stringify(request));
			return false;
		}

		return true;
	}
);

log('Redirector starting up...');

ReloadRedirections()
setUpRedirectListener();

chrome.runtime.onInstalled.addListener(function (){
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