var storageArea = chrome.storage.local;
var lastURL = window.location.href

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     console.log(request.data);
// });

function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function create(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);
    element.$$children = [];

    function setAttribute(name, value) {
        try {
            element.setAttribute(name, value);
        } catch (error) {
            console.error(`Error setting attribute ${name}:`, error);
        }
    }

    for (const [key, value] of Object.entries(attributes)) {
        setAttribute(key, value);
    }

    children.forEach(child => {
        if (child instanceof HTMLElement) {
            element.appendChild(child);
            element.$$children.push(child);
        } else if (typeof child === 'string') {
            const textNode = document.createTextNode(child);
            element.appendChild(textNode);
            element.$$children.push(textNode);
        }
    });

    element.getChild = function(selector) {
        const matches = selector.match(/(\w+)(\[(\d+)\])?/);
        if (!matches) return null;

        const tag = matches[1];
        const index = matches[3] ? parseInt(matches[3]) - 1 : 0;

        return this.$$children.filter(child => child.tagName.toLowerCase() === tag.toLowerCase())[index] || null;
    }

    return element;
}

function SetButton(v, callback) {
    v.addEventListener("mousedown", spawnRipple.bind(this), {
        passive: !0
    })
    function spawnRipple(e){
        const o = (Math.min(Math.max(v.offsetHeight, v.offsetWidth), v.maxSize || 300) - 2) * .85
        const {x: r, y: s} = (() => {
            if (!e.target)
                return e;
            let n = e.target;
            const r = n.isSameNode(v);
            if (e.offsetX !== void 0 && r)
                return {
                    x: e.offsetX,
                    y: e.offsetY
                };
            const s = {
                x: 0,
                y: 0
            };
            for (; !n.isSameNode(v) && n.offsetParent; )
                s.x += n.offsetLeft,
                s.y += n.offsetTop,
                n = n.offsetParent;
            return s.x = e.offsetX + s.x, s.y = e.offsetY + s.y, s
        })()
        const ripple = create('div', { class: 'sf-ripple' });

        Object.assign(ripple.style, {
            transform: "scale(0) translateZ(0)",
            width: (o * 2).toString() + "px",
            height: (o * 2).toString() + "px",
            left: (r - o).toString() + "px",
            top: (s - o).toString() + "px",
            backgroundColor: window.getComputedStyle(v).color
        })
        window.requestAnimationFrame(() => {
            v.appendChild(ripple)
            window.requestAnimationFrame(() => {
                ripple.style.transform = "scale(1) translateZ(0)"
            })
        })
        window.addEventListener("mouseup", removeRipple.bind(this, ripple), {
            passive: !0,
            once: !0
        });
    }
    function removeRipple(e){
        e && (setTimeout( () => {
            e.style.opacity = 0
        }, 150),
        setTimeout( () => {
            window.requestAnimationFrame( () => {
                v.removeChild(e)
            })
        }, 500))
    }
    v.addEventListener("click", callback);
}

function ifDomain(f) {
    storageArea.get({
        domain: ""
    }, function(obj) {
        if (window.location.href.startsWith(obj.domain)) {
            f(obj.domain)
        }
    })
}

async function SearchSerie(name, type) {
    const o_name =  name
    const filtered_specials = name.split(/[^a-zA-Z0-9áéíóúüÁÉÍÓÚÜ\s]+/).map(p => p.trim()).filter(p => p.length > 0)
    if (filtered_specials.length > 1) {
        name = filtered_specials.sort((a, b) => b.length - a.length)[0]
    } else {
        name = name.startsWith(name.match(/\S*[áéíóúü]\S*/i) && name.match(/\S*[áéíóúü]\S*/i)[0]) ? name.replace(`${name.match(/\S*[áéíóúü]\S*/i)[0]} `, "").trim() : name
    }

    const res = JSON.parse(await fetch(`https://dashboard.olympuslectura.com/api/search?name=${name.substring(0, 40)}`).then(response => response.text()))

    return (res.data && res.data.length > 0) && await res.data.find(i => {
        if (i.name.toLowerCase() === o_name.toLowerCase() && i.type === type) {
            return i
        }
    })
}

const Data = {}
function Load() {
    lastURL = window.location.href

    ifDomain(async function(domain) {
        console.log(domain)
        let serie_data = (window.location.pathname.startsWith('/series/') || window.location.pathname.startsWith('/capitulo/')) && (Data[window.location.pathname.split('/')[window.location.pathname.startsWith('/series/') ? 2 : 3]] || JSON.parse(await fetch(`https://${window.location.host}/api/series/${window.location.pathname.split('/')[window.location.pathname.startsWith('/series/') ? 2 : 3].split(/-(.+)/)[1]}?type=${(window.location.pathname.split('/')[window.location.pathname.startsWith('/series/') ? 2 : 3].split(/-(.+)/)[0]) === "novela" ? "novel" : "comic"}`).then(response => response.text())))
        if (serie_data && typeof serie_data == 'object' && serie_data.data) {
            Data[window.location.pathname.split('/')[window.location.pathname.startsWith('/series/') ? 2 : 3]] = serie_data
        } else {
            serie_data = null

            no_data_url = window.location.href
            if (window.location.pathname.startsWith('/capitulo/')) {
                const h1 = await waitForElm("#__nuxt .sf-ripple-container") && await waitForElm("#__nuxt > div > div > header > div > div > div.flex-center.px-4 > div > a > h1")
                if (h1?.textContent.length > 0) {
                    const serie = await SearchSerie(h1.textContent, ((window.location.pathname.split('/')[3].split(/-(.+)/)[0]) === "novela" ? "novel" : "comic"))

                    if (serie) window.location.href = window.location.href.replace(window.location.pathname.split('/')[3].split(/-(.+)/)[1], serie.slug)
                }
            } else if (window.location.pathname.startsWith('/series/')) {

            }
        }

        // Boton de favoritos
        if (!document.getElementById("extension_button_addserie") && window.location.pathname.startsWith("/series/")) {
            const serie_actions = await waitForElm("#__nuxt > div > main > div > div:nth-child(1) > div.p-8.relative.bg-gray-800.rounded-md.min-w-80.lg\\:max-w-80.overflow-hidden > div.z-10.relative.flex.flex-col.items-center.gap-4.text-center > div:nth-child(4) > button:nth-child(1).sf-ripple-container").then(elm => elm.parentElement)
            
            if (document.getElementById("extension_button_addserie")) return

            const button = create('button', { id: 'extension_button_addserie', class: 'rounded-full p-1 text-3xl sf-ripple-container' }, [
                create('i', { class: 'i-heroicons-bookmark text-gray-300', xyz: 'fade scale-1' })
            ]);
            const icon = button.getChild('i')
            
            var Toggle = false

            try {
                await storageArea.get({
                    series: []
                }, async function(obj) {
                    const series = obj.series
                    if (series.length > 0 && series.map(i => i.data.id).includes(serie_data.data.id)) {
                        Toggle = true
                        
                        icon.className = "i-heroicons-bookmark-solid text-amber-300";
                    }
                })
            } catch (error) { window.location.reload() }

            try {
                SetButton(button, async function() {
                    try {
                        Toggle = !Toggle
                    
                        if (Toggle) {
                            await storageArea.get({
                                series: []
                            }, async function(obj) {
                                const series = obj.series
                                if (!series.map(i => i.data.id).includes(serie_data.data.id)) {
                                    series.push(serie_data)

                                    await storageArea.set({
                                        series: series
                                    })
                                }
                            })
                            
                            icon.className = "i-heroicons-bookmark-solid text-amber-300";
                        } else {
                            await storageArea.get({
                                series: []
                            }, async function(obj) {
                                const series = obj.series

                                const indexToRemove = series.findIndex(i => i.data.id === serie_data.data.id)
                                if (indexToRemove > -1 && indexToRemove < series.length) {
                                    series.splice(indexToRemove, 1)
                                }
                                
                                await storageArea.set({
                                    series: series
                                })
                            })

                            icon.className = "i-heroicons-bookmark text-gray-300";
                        }
                    } catch (error) { window.location.reload() }
                })
            } catch (error) { window.location.reload() }
            
            serie_actions.insertBefore(button, serie_actions.firstChild);
        }

        // Boton de menu
        if (!document.getElementById("extension_button_series")) {
            const header_buttons = await waitForElm("#__nuxt header button.sf-ripple-container").then(elm => {
                if (!elm.parentElement.classList.contains('flex-end')) {
                    if (elm.parentElement.parentElement.classList.contains('relative')) {
                        elm.parentElement.classList.add('absolute', 'flex-end', 'gap-2', 'md:gap-6');
                        elm.parentElement.parentElement.classList.remove('relative')
                        elm.parentElement.parentElement.classList.add('flex-end')
                    } else if (elm.parentElement.parentElement.classList.contains('container')) {
                        const div = create('div', { class: 'flex-end', }, [
                            create('div', { class: 'absolute flex-end gap-2 md:gap-6', })
                        ])
                        elm.parentElement.appendChild(div)
                        elm.parentElement.removeChild(elm);
                        div.getChild('div').appendChild(elm)
                        return div.getChild('div')
                    }
                }
                return elm.parentElement
            })

            if (document.getElementById("extension_button_series")) return
    
            const button = create('button', { id: 'extension_button_series', class: 'aspect-square rounded-full hover:bg-gray-800 transition-background-color p-2 sf-ripple-container' }, [
                create('i', { class: 'text-2xl i-heroicons-cloud-solid' })
            ]);
            
            const article = create('article', { class: 'fixed top-0 left-0 w-full h-screen z-100 bg-gray-600/70 flex-center xyz-in-to', xyz: 'fade' }, [
                create('div', { class: 'xyz-nested relative mx-1', xyz: 'down-5' }, [
                    create('div', { class: 'absolute w-full flex-between z-10', xyz: 'fade down-5', style: 'top: -35px !important; left: 50px !important;' }, [
                        create('div', { class: 'xyz-nested', xyz: 'fade down-5' }),
                        create('button', { class: 'xyz-nested w-12 aspect-square bg-gray-900/50 hover:bg-gray-900/80 backdrop-blur transition-background-color rounded-full flex-center text-3xl sf-ripple-container', xyz: 'fade down-5' }, [
                            create('i', { class: 'i-heroicons-x-mark' })
                        ])
                    ]),
                    create('main', { class: 'relative z-20', tabindex:'-1' }, [
                        create('div', { class: 'bg-gray-800/80 backdrop-blur rounded-xl w-full', style: 'width: 530px !important;' }, [
                            create('div', { 
                                class: 'bg-gray-900/10 p-4 rounded-t-xl shadow-xl',
                                style: 'padding-bottom: 0.5rem;' 
                            }, [
                                create('nav', { class: 'hidden md:flex items-center gap-2 relative' })
                            ]),
                            create('div', { class: 'h-100 overflow-y-scroll relative', style: 'scrollbar-width: none !important; display: none; padding: 10px; flex-wrap: wrap;' }),
                            create('div', { class: 'h-100 overflow-y-scroll relative', style: 'scrollbar-width: none !important; display: none; padding: 10px; flex-direction: column;' })
                        ])
                    ])
                ])
            ]);
            const content = article.getChild('div')
            const main = content.getChild('main')

            const tabs = []
            function CreateTab(title, icon, content, visible) {
                const newTab = create('button', { 
                    class: 'hover:bg-gray-800 px-3 py-0.5 rounded-md transition-background-color flex items-center gap-2' 
                }, [
                    create('i', { class: `${icon} text-xl`, style: 'margin-bottom: 1px;' }),
                    title
                ])
                newTab.addEventListener('click', () => {
                    showTabContent();
                });

                function showTabContent() {
                    tabs.forEach(i => {
                        if (i.content != content) {
                            i.content.style.display = 'none';
                        } else {
                            i.content.style.display = 'flex';
                        }
                        if (i.tab != newTab) {
                            if (i.tab.classList.contains('tab-enable')) i.tab.classList.remove('tab-enable')
                            if (!i.tab.classList.contains('hover:bg-gray-800')) i.tab.classList.add('hover:bg-gray-800')
                        } else {
                            if (i.tab.classList.contains('hover:bg-gray-800')) i.tab.classList.remove('hover:bg-gray-800')
                            if (!i.tab.classList.contains('tab-enable')) i.tab.classList.add('tab-enable')
                        }
                    });
                }

                tabs.push({ tab: newTab, content: content })

                if (visible) showTabContent()

                main.getChild('div').getChild('div').getChild('nav').appendChild(newTab)
            }

            const closeButton = content.getChild('div').getChild('button')
            closeButton.addEventListener('click', () => {
                document.body.removeChild(article);
            });
            
            article.addEventListener('click', (e) => {
                if (article.parentElement && !main.contains(e.target)) {
                    document.body.removeChild(article);
                }
            });
    
            const favorites_container = main.getChild('div').getChild('div[2]')
            const history_container = main.getChild('div').getChild('div[3]')
            try {
                SetButton(button, async function() {
                    try {
                        favorites_container.innerHTML = ''
                        history_container.innerHTML = ''
    
                        
                        await storageArea.get({
                            history: {},
                            series: []
                        }, async function(obj) {
                            const history = Object.entries(obj.history).sort(([_1, a], [_2, b]) => b.time - a.time)
                            const series = obj.series
                            history.map(([_, i]) => {
                                const timeSince = (() => {
                                    const now = new Date();
                                    const seconds = Math.floor((now - i.time) / 1000);
                                    const minutes = Math.floor(seconds / 60);
                                    const hours = Math.floor(seconds / 3600);
                                    const days = Math.floor(seconds / 86400);
                                    const months = Math.floor(seconds / 2592000);
                                    const years = Math.floor(seconds / 31536000);
                                
                                    if (years > 0) {
                                        return `hace ${years} año${years > 1 ? 's' : ''}`;
                                    } else if (months > 0) {
                                        return `hace ${months} mes${months > 1 ? 'es' : ''}`;
                                    } else if (days > 0) {
                                        return `hace ${days} día${days > 1 ? 's' : ''}`;
                                    } else if (hours > 0) {
                                        return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
                                    } else if (minutes > 0) {
                                        return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
                                    } else {
                                        return `hace unos segundos`;
                                    }
                                })()
                                
                                function newElement(i) {
                                    const element =  create('div', { id: 'history_element', class: 'p-2 md:p-4 bg-gray-800 rounded-md relative', style: 'height: min-content; margin: 5px;' }, [
                                        create('div', { class: 'absolute top-0 left-0 h-full', style: 'opacity: .4;' }, [
                                            create('div', { class: 'relative rounded-l-md h-full aspect-square' }, [
                                                create('img', {
                                                    src: i.serie.cover,
                                                    alt: i.serie.name,
                                                    loading: 'lazy',
                                                    class: 'object-cover rounded-inherit w-full h-full',
                                                    style: 'min-height: initial;'
                                                })
                                            ]),
                                            create('div', {
                                                class: 'absolute bottom-0 left-0 h-full aspect-square bg-gradient-to-r from-transparent via-gray-800/85 to-gray-800'
                                            })
                                        ]),
                                        create('figure', { class: 'flex items-center gap-4 z-20 relative' }, [
                                            create('div', { class: 'w-full' }, [
                                                create('div', { class: 'flex-between', style:'margin-bottom: 5px;' }, [
                                                    create('a', {
                                                        href: `/capitulo/${i.id}/${i.serie.type === "novel" ? "novela" : "comic"}-${i.serie.slug}`,
                                                        class: 'rounded'
                                                    }, [
                                                        create('figcaption', { class: 'font-medium text-base' }, [`Capítulo ${i.name}`])
                                                    ]),
                                                    create('time', { class: 'text-xs text-gray-500 first-letter:capitalize', datetime: i.time }, [ timeSince ])
                                                ]),
                                                create('div', { class: 'flex-between' }, [
                                                    create('a', {
                                                        href: `/series/${i.serie.type === "novel" ? "novela" : "comic"}-${i.serie.slug}`,
                                                        class: 'text-amber-300 text-xs font-light'
                                                    }, [ i.serie.name ]),
                                                    create('button', { title: 'Actualizar Link', class: 'absolute aspect-square rounded-full hover:bg-gray-800 transition-background-color text-rose-300 sf-ripple-container', style: 'height: 20px; width: 20px; right: 0; justify-content: center; align-items: center; display: none;' }, [
                                                        create('i', { class: 'text-2xl i-heroicons-exclamation-triangle', style: 'height: 16px; width: 16px;' })
                                                    ])
                                                ]),
                                            ])
                                        ])
                                    ])
                                    const fix_button = element.getChild('figure').getChild('div').getChild('div[2]').getChild('button')
                                    const chapt_button = element.getChild('figure').getChild('div').getChild('div').getChild('a')
                                    const serie_button = element.getChild('figure').getChild('div').getChild('div[2]').getChild('a')
    
                                    var Checked = false
    
                                    if (i.disabled) {
                                        Checked = true
    
                                        chapt_button.classList.add('text-slate-500')
                                            
                                        serie_button.classList.add('text-amber-500')
                                        serie_button.classList.remove('text-amber-300')
    
                                        fix_button.style.display = 'flex';
                                    }
    
                                    async function CheckLinks(e) {
                                        e.preventDefault();
                                        if (!i.disabled && !Checked) {
                                            Checked = true
                                            try { await fetch(`https://${window.location.host}/api/series/${i.serie.slug}?type=${i.serie.type}`).then(response => {
                                                i.disabled = !response.ok
    
                                                if (!response.ok) {
                                                    chapt_button.classList.add('text-slate-500')
                                                        
                                                    serie_button.classList.add('text-amber-500')
                                                    serie_button.classList.remove('text-amber-300')
    
                                                    fix_button.style.display = 'flex';
                                                }
    
                                                storageArea.set({
                                                    history: history.reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
                                                })
                                            }) } catch (error) {}
                                        }
                                        if (i.disabled) return
    
                                        if (e.button === 1 || (e.ctrlKey || e.metaKey)) {
                                            window.open(this.href, '_blank')
                                        } else {
                                            window.location.href = this.href
                                        }
                                    }
    
                                    chapt_button.addEventListener("click", CheckLinks);
                                    serie_button.addEventListener("click", CheckLinks);
                                    
                                    SetButton(fix_button, async function() {
                                        const serie = await SearchSerie(i.serie.name, i.serie.type)
    
                                        if (serie) {
                                            i.serie = JSON.parse(await fetch(`https://${window.location.host}/api/series/${serie.slug}?type=${serie.type}`).then(response => response.text())).data
                                            delete i.disabled;
    
                                            element.innerHTML = ''
                                            newElement(i).$$children.map(e => element.appendChild(e))
    
                                            storageArea.set({
                                                history: history.reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {})
                                            })
                                        }
                                    })
    
                                    return element
                                }
                                
                                history_container.appendChild(newElement(i))
                            })
                            // Object.entries(history).sort((a, b) => b.time - a.time).map(async ([k, i]) => {
                            //     const timeSince = (() => {
                            //         const now = new Date();
                            //         const seconds = Math.floor((now - i.time) / 1000);
                            //         const minutes = Math.floor(seconds / 60);
                            //         const hours = Math.floor(seconds / 3600);
                            //         const days = Math.floor(seconds / 86400);
                            //         const months = Math.floor(seconds / 2592000);
                            //         const years = Math.floor(seconds / 31536000);
                                
                            //         if (years > 0) {
                            //             return `hace ${years} año${years > 1 ? 's' : ''}`;
                            //         } else if (months > 0) {
                            //             return `hace ${months} mes${months > 1 ? 'es' : ''}`;
                            //         } else if (days > 0) {
                            //             return `hace ${days} día${days > 1 ? 's' : ''}`;
                            //         } else if (hours > 0) {
                            //             return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
                            //         } else if (minutes > 0) {
                            //             return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
                            //         } else {
                            //             return `hace unos segundos`;
                            //         }
                            //     })()
    
                            //     function newElement(i) {
                            //         const element =  create('div', { id: 'history_element', class: 'p-2 md:p-4 bg-gray-800 rounded-md relative', style: 'height: min-content; margin: 5px;' }, [
                            //             create('div', { class: 'absolute top-0 left-0 h-full', style: 'opacity: .4;' }, [
                            //                 create('div', { class: 'relative rounded-l-md h-full aspect-square' }, [
                            //                     create('img', {
                            //                         src: i.serie.cover,
                            //                         alt: i.serie.name,
                            //                         loading: 'lazy',
                            //                         class: 'object-cover rounded-inherit w-full h-full',
                            //                         style: 'min-height: initial;'
                            //                     })
                            //                 ]),
                            //                 create('div', {
                            //                     class: 'absolute bottom-0 left-0 h-full aspect-square bg-gradient-to-r from-transparent via-gray-800/85 to-gray-800'
                            //                 })
                            //             ]),
                            //             create('figure', { class: 'flex items-center gap-4 z-20 relative' }, [
                            //                 create('div', { class: 'w-full' }, [
                            //                     create('div', { class: 'flex-between', style:'margin-bottom: 5px;' }, [
                            //                         create('a', {
                            //                             href: `/capitulo/${i.id}/${i.serie.type === "novel" ? "novela" : "comic"}-${i.serie.slug}`,
                            //                             class: 'rounded'
                            //                         }, [
                            //                             create('figcaption', { class: 'font-medium text-base' }, [`Capítulo ${i.name}`])
                            //                         ]),
                            //                         create('time', { class: 'text-xs text-gray-500 first-letter:capitalize', datetime: i.time }, [ timeSince ])
                            //                     ]),
                            //                     create('div', { class: 'flex-between' }, [
                            //                         create('a', {
                            //                             href: `/series/${i.serie.type === "novel" ? "novela" : "comic"}-${i.serie.slug}`,
                            //                             class: 'text-amber-300 text-xs font-light'
                            //                         }, [ i.serie.name ]),
                            //                         create('button', { title: 'Actualizar Link', class: 'absolute aspect-square rounded-full hover:bg-gray-800 transition-background-color text-rose-300 sf-ripple-container', style: 'height: 20px; width: 20px; right: 0; justify-content: center; align-items: center; display: none;' }, [
                            //                             create('i', { class: 'text-2xl i-heroicons-exclamation-triangle', style: 'height: 16px; width: 16px;' })
                            //                         ])
                            //                     ]),
                            //                 ])
                            //             ])
                            //         ])
                            //         const fix_button = element.getChild('figure').getChild('div').getChild('div[2]').getChild('button')
                            //         const chapt_button = element.getChild('figure').getChild('div').getChild('div').getChild('a')
                            //         const serie_button = element.getChild('figure').getChild('div').getChild('div[2]').getChild('a')
    
                            //         var Checked = false
    
                            //         if (i.disabled) {
                            //             Checked = true
    
                            //             chapt_button.classList.add('text-slate-500')
                                            
                            //             serie_button.classList.add('text-amber-500')
                            //             serie_button.classList.remove('text-amber-300')
    
                            //             fix_button.style.display = 'flex';
                            //         }
    
                            //         async function CheckLinks(e) {
                            //             e.preventDefault();
                            //             if (!history[k].disabled && !Checked) {
                            //                 Checked = true
                            //                 try { await fetch(`https://${window.location.host}/api/series/${i.serie.slug}?type=${i.serie.type}`).then(response => {
                            //                     history[k].disabled = !response.ok
    
                            //                     if (!response.ok) {
                            //                         chapt_button.classList.add('text-slate-500')
                                                        
                            //                         serie_button.classList.add('text-amber-500')
                            //                         serie_button.classList.remove('text-amber-300')
    
                            //                         fix_button.style.display = 'flex';
                            //                     }
    
                            //                     storageArea.set({
                            //                         history: history
                            //                     })
                            //                 }) } catch (error) {}
                            //             }
                            //             if (history[k].disabled) return
    
                            //             if (e.button === 1 || (e.ctrlKey || e.metaKey)) {
                            //                 window.open(this.href, '_blank')
                            //             } else {
                            //                 window.location.href = this.href
                            //             }
                            //         }
    
                            //         chapt_button.addEventListener("click", CheckLinks);
                            //         serie_button.addEventListener("click", CheckLinks);
                                    
                            //         SetButton(fix_button, async function() {
                            //             const serie = await SearchSerie(i.serie.name, i.serie.type)
    
                            //             if (serie) {
                            //                 history[k].serie = JSON.parse(await fetch(`https://${window.location.host}/api/series/${serie.slug}?type=${serie.type}`).then(response => response.text())).data
                            //                 delete history[k].disabled;
    
                            //                 element.innerHTML = ''
                            //                 newElement(history[k]).$$children.map(e => element.appendChild(e))
    
                            //                 storageArea.set({
                            //                     history: history
                            //                 })
                            //             }
                            //         })
    
                            //         return element
                            //     }
    
                            //     await history_container.appendChild(newElement(i))
                            // })
                            series.map(i => {
                                function newElement(i) {
                                    const element = create('figure', { class: 'relative overflow-hidden rounded-md snap-start', style:'min-width: 160px; width: 160px; margin: 5px;' }, [
                                        create('a', { href: `/series/${i.data.type === "novel" ? "novela" : "comic"}-${i.data.slug}`, class: 'block rounded-md sf-ripple-container' }, [
                                            create('div', { class: 'relative w-full rounded-md' }, [
                                                create('img', {
                                                    src: i.data.cover,
                                                    alt: i.data.name,
                                                    loading: 'eager',
                                                    class: 'object-cover rounded-inherit w-full h-full',
                                                    style: 'min-height: initial;',
                                                }),
                                            ]),
                                            create('div', { class: 'absolute pointer-events-none w-full h-2/4 bg-gradient-to-b from-transparent via-gray-800/70 to-gray-800/90 rounded-md', style: 'bottom: 0' }),
                                            
                                            create('div', { class: 'absolute bottom-left w-full py-2 px-1 md:px-2 rounded-inherit text-center flex flex-col gap-2', style: 'bottom: 0' }, [
                                                create('a', { href: `/series/${i.data.type === "novel" ? "novela" : "comic"}-${i.data.slug}`, class: 'rounded-md sf-ripple-container' }, [
                                                    create('figcaption', { class: 'font-header text-lg leading-5 line-clamp-3', }, [ i.data.name ]),
                                                ]),
                                                create('div', { class: 'flex-center gap-1 md:gap-2' }, [
                                                    create('div', {
                                                        class: 'text-sm font-header h-8 backdrop-blur flex-center px-3 rounded-lg capitalize ' + (i.data.type === 'novel' ? 'text-emerald-300 bg-emerald-600/10' : 'text-sky-300 bg-sky-600/10')
                                                    }, [ i.data.type ]),
                                                ]),
                                            ]),
                                        ]),
                                        create('button', { title: 'Actualizar Link', class: 'absolute aspect-square rounded-full hover:bg-gray-800 transition-background-color text-rose-300 sf-ripple-container', style: 'height: 34px; width: 34px; transform: translate(17px, -17px); right: 50%; top: 50%; justify-content: center; align-items: center; display: none;' }, [
                                            create('i', { class: 'text-2xl i-heroicons-exclamation-triangle', style: 'height: 28px; width: 28px;' })
                                        ])
                                    ])
                                    const fix_button = element.getChild('button')
                                    const serie_button_1 = element.getChild('a')
                                    const serie_button_2 = element.getChild('a').getChild('div[3]').getChild('a')
                                    
                                    var Checked = false
    
                                    if (i.disabled) {
                                        Checked = true
    
                                        serie_button_1.style.opacity = '20%'
    
                                        fix_button.style.display = 'flex';
                                    }
    
                                    var cooldown = false
                                    async function CheckLinks(e) {
                                        e.preventDefault();
    
                                        if (cooldown) return
                                        cooldown = true
    
                                        if (!i.disabled && !Checked) {
                                            Checked = true
                                            try { await fetch(`https://${window.location.host}/api/series/${i.data.slug}?type=${i.data.type}`).then(response => {
                                                i.disabled = !response.ok
    
                                                if (!response.ok) {
                                                    serie_button_1.style.opacity = '20%'
    
                                                    fix_button.style.display = 'flex';
                                                }
    
                                                storageArea.set({
                                                    series: series
                                                })
                                            }) } catch (error) {}
                                        }
                                        if (i.disabled) return
    
                                        if (e.button === 1 || (e.ctrlKey || e.metaKey)) {
                                            window.open(this.href, '_blank')
                                        } else {
                                            window.location.href = this.href
                                        }
                                        cooldown = false
                                    }
    
                                    serie_button_1.addEventListener("click", CheckLinks);
                                    serie_button_2.addEventListener("click", CheckLinks);
    
                                    SetButton(fix_button, async function() {
                                        const serie = await SearchSerie(i.data.name, i.data.type)
    
                                        if (serie) {
                                            i.data = JSON.parse(await fetch(`https://${window.location.host}/api/series/${serie.slug}?type=${serie.type}`).then(response => response.text())).data
                                            delete i.disabled;
    
                                            element.innerHTML = ''
                                            newElement(i).$$children.map(e => element.appendChild(e))
    
                                            storageArea.set({
                                                series: series
                                            })
                                        }
                                    })
    
                                    return element
                                }
    
                                favorites_container.appendChild(newElement(i));
                            })
                        })
                        
            
                        document.body.insertBefore(article, document.body.firstChild);
                    } catch (error) { window.location.reload() }
                })
            } catch (error) { window.location.reload() }
            
            CreateTab('Favoritos', 'i-heroicons-bookmark-solid', favorites_container, true)
            CreateTab('Historial', 'i-heroicons-clock-solid', history_container)
    
            header_buttons.insertBefore(button, header_buttons.firstChild);
        }

        // Guardar historial
        if (window.location.pathname.startsWith('/capitulo/') && serie_data) {
            await storageArea.get({
                history: {}
            }, async function(obj) {
                const history = obj.history
                if (!history[`${serie_data.data.id}_${window.location.pathname.split('/')[2]}`]) {
                    const checkNumber = setInterval(async () => {
                        if (!isNaN(Number(document.title.split(' ')[1]))) {
                            clearInterval(checkNumber);
                            
                            history[`${serie_data.data.id}_${window.location.pathname.split('/')[2]}`] = {
                                serie: serie_data.data,
                                id: window.location.pathname.split('/')[2],
                                name: document.title.split(' ')[1],
                                time: new Date().getTime()
                            }

                            await storageArea.set({
                                history: history
                            })
                        }
                    }, 100);
                }
            })
        }
    })
}

const observer = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
        Load();
    }
});

ifDomain(function() {
    observer.observe(document.head.querySelector('title'), { childList: true, subtree: true });

    Load();
})