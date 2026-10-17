// Busca de jogos por nome ou palavra-chave, feita inteiramente no navegador.
// O índice /search.json (título, slug, categoria, imagem e resumo de cada
// jogo) é gerado pelo main.go a cada exportação e só é baixado quando o
// visitante começa a usar a busca, então não pesa no carregamento da página.
//
// - Todo <form class="site-search"> ganha sugestões enquanto se digita
//   (setas para navegar, Enter para abrir, Esc para fechar).
// - Em /search/?q=termo, a grade completa de resultados é montada e paginada.
(function () {
    'use strict';

    var INDEX_URL = '/search.json';
    var MIN_QUERY_LENGTH = 2;
    var MAX_SUGGESTIONS = 8;
    var RESULTS_PAGE_SIZE = 48;
    var indexPromise = null;
    var formCount = 0;

    // Minúsculas, sem acentos e só letras/números: "Pac-Man Ç" -> "pac man c".
    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function loadIndex() {
        if (!indexPromise) {
            indexPromise = fetch(INDEX_URL)
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.json();
                })
                .then(function (games) {
                    return games.map(function (game) {
                        var title = normalize(game.t);
                        return {
                            game: game,
                            title: title,
                            titleWords: title.split(' '),
                            category: normalize(game.c),
                            text: ' ' + normalize(game.d) + ' '
                        };
                    });
                })
                .catch(function (error) {
                    indexPromise = null; // permite tentar de novo na próxima busca
                    throw error;
                });
        }
        return indexPromise;
    }

    // Pontua um jogo: título pesa mais que categoria, que pesa mais que a
    // descrição. "matched" conta quantas palavras da busca foram encontradas.
    function scoreEntry(entry, query, tokens) {
        var score = 0;
        if (entry.title === query) {
            score += 100;
        } else if (entry.title.indexOf(query) === 0) {
            score += 60;
        } else if (entry.title.indexOf(query) !== -1) {
            score += 40;
        }

        var matched = 0;
        tokens.forEach(function (token) {
            var points = 0;
            if (entry.titleWords.some(function (word) { return word.indexOf(token) === 0; })) {
                points = 12;
            } else if (entry.title.indexOf(token) !== -1) {
                points = 8;
            } else if (entry.category.indexOf(token) !== -1) {
                points = 6;
            } else if (entry.text.indexOf(' ' + token + (token.length < 4 ? ' ' : '')) !== -1) {
                // Na descrição só conta início de palavra ("ball" acha "balls",
                // não "basketball"); palavras curtas exigem a palavra inteira,
                // senão "car" acharia todo "carefully".
                points = 2;
            }
            if (points) {
                matched++;
                score += points;
            }
        });
        return { score: score, matched: matched };
    }

    // Primeiro exige todas as palavras; se nada bater, mostra os jogos que
    // batem com parte delas (partial = true) em vez de uma página vazia.
    function searchGames(entries, rawQuery) {
        var query = normalize(rawQuery);
        if (!query) {
            return { results: [], partial: false };
        }
        // Letras soltas ("a", "x") batem em quase todo jogo; só contam se forem a busca inteira.
        var tokens = query.split(' ').filter(function (token) { return token.length > 1; });
        if (!tokens.length) {
            tokens = [query];
        }
        var full = [];
        var partial = [];

        entries.forEach(function (entry) {
            var result = scoreEntry(entry, query, tokens);
            if (result.matched === tokens.length) {
                full.push({ game: entry.game, score: result.score });
            } else if (result.matched > 0) {
                partial.push({ game: entry.game, score: result.score });
            }
        });

        var list = full.length ? full : partial;
        list.sort(function (a, b) {
            return b.score - a.score || a.game.t.localeCompare(b.game.t);
        });
        return {
            results: list.map(function (item) { return item.game; }),
            partial: !full.length && partial.length > 0
        };
    }

    function gameUrl(game) {
        return '/game/' + encodeURIComponent(game.s) + '/';
    }

    function searchUrl(query) {
        return '/search/?q=' + encodeURIComponent(query);
    }

    // ---------- Sugestões enquanto digita ----------

    function enhanceForm(form) {
        var input = form.querySelector('input[name="q"]');
        var box = form.querySelector('.site-search-box');
        if (!input || !box) {
            return;
        }

        var listId = 'search-suggestions-' + (++formCount);
        var list = document.createElement('ul');
        list.id = listId;
        list.className = 'search-suggestions';
        list.setAttribute('role', 'listbox');
        list.hidden = true;
        box.appendChild(list);

        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', listId);
        input.setAttribute('aria-expanded', 'false');

        var activeIndex = -1;
        var timer = null;

        function options() {
            return list.querySelectorAll('[role="option"]');
        }

        function close() {
            list.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            activeIndex = -1;
        }

        function setActive(index) {
            var all = options();
            Array.prototype.forEach.call(all, function (option, i) {
                option.setAttribute('aria-selected', i === index ? 'true' : 'false');
            });
            activeIndex = index;
            if (index >= 0 && all[index]) {
                input.setAttribute('aria-activedescendant', all[index].id);
                all[index].scrollIntoView({ block: 'nearest' });
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        }

        function addOption(link, className) {
            var li = document.createElement('li');
            li.id = listId + '-' + list.children.length;
            li.className = className || '';
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            link.tabIndex = -1;
            li.appendChild(link);
            list.appendChild(li);
        }

        function render(results, query) {
            list.innerHTML = '';
            activeIndex = -1;

            if (!results.length) {
                var empty = document.createElement('li');
                empty.className = 'search-suggestion-empty';
                empty.textContent = 'No games found for "' + query + '"';
                list.appendChild(empty);
            } else {
                results.slice(0, MAX_SUGGESTIONS).forEach(function (game) {
                    var link = document.createElement('a');
                    link.href = gameUrl(game);

                    if (game.i) {
                        var img = document.createElement('img');
                        img.src = game.i;
                        img.alt = '';
                        img.loading = 'lazy';
                        link.appendChild(img);
                    }
                    var text = document.createElement('span');
                    var title = document.createElement('span');
                    title.className = 'suggestion-title';
                    title.textContent = game.t;
                    var category = document.createElement('span');
                    category.className = 'suggestion-category';
                    category.textContent = game.c;
                    text.appendChild(title);
                    text.appendChild(category);
                    link.appendChild(text);
                    addOption(link);
                });

                var all = document.createElement('a');
                all.href = searchUrl(query);
                all.textContent = 'See all ' + results.length + (results.length === 1 ? ' result' : ' results');
                addOption(all, 'suggestion-all');
            }

            list.hidden = false;
            input.setAttribute('aria-expanded', 'true');
        }

        function update() {
            var value = input.value;
            if (normalize(value).length < MIN_QUERY_LENGTH) {
                close();
                return;
            }
            loadIndex().then(function (entries) {
                if (input.value !== value) {
                    return; // o visitante já digitou outra coisa
                }
                render(searchGames(entries, value).results, value.trim());
            }).catch(close);
        }

        input.addEventListener('input', function () {
            clearTimeout(timer);
            timer = setTimeout(update, 120);
        });

        input.addEventListener('focus', function () {
            loadIndex().catch(function () {});
            if (normalize(input.value).length >= MIN_QUERY_LENGTH) {
                update();
            }
        });

        input.addEventListener('keydown', function (event) {
            if (list.hidden) {
                return;
            }
            var count = options().length;
            if (event.key === 'ArrowDown' && count) {
                event.preventDefault();
                setActive(activeIndex + 1 >= count ? 0 : activeIndex + 1);
            } else if (event.key === 'ArrowUp' && count) {
                event.preventDefault();
                setActive(activeIndex - 1 < 0 ? count - 1 : activeIndex - 1);
            } else if (event.key === 'Enter' && activeIndex >= 0) {
                event.preventDefault();
                window.location.href = options()[activeIndex].querySelector('a').href;
            } else if (event.key === 'Escape') {
                close();
            }
        });

        document.addEventListener('click', function (event) {
            if (!form.contains(event.target)) {
                close();
            }
        });

        form.addEventListener('submit', function (event) {
            if (!normalize(input.value)) {
                event.preventDefault();
                input.focus();
            }
        });
    }

    // ---------- Página /search/ ----------

    function buildCard(game) {
        var col = document.createElement('div');
        col.className = 'col-md-2 col-sm-6 mb-2';

        var link = document.createElement('a');
        link.href = gameUrl(game);
        var img = document.createElement('img');
        img.src = game.i;
        img.alt = game.t;
        img.title = game.t;
        img.className = 'img-fluid image-container';
        img.loading = 'lazy';
        link.appendChild(img);

        var title = document.createElement('h5');
        title.className = 'card-title mt-2';
        title.textContent = game.t;

        var categoryLink = document.createElement('a');
        categoryLink.href = '/category/' + encodeURIComponent(game.c) + '/';
        categoryLink.className = 'text-decoration-none';
        var category = document.createElement('p');
        category.className = 'text-muted';
        category.textContent = game.c;
        categoryLink.appendChild(category);

        col.appendChild(link);
        col.appendChild(title);
        col.appendChild(categoryLink);
        return col;
    }

    function renderResultsPage() {
        var container = document.querySelector('[data-search-results]');
        var status = document.getElementById('search-status');
        if (!container || !status) {
            return;
        }

        var query = (new URLSearchParams(window.location.search).get('q') || '').trim();
        Array.prototype.forEach.call(document.querySelectorAll('form.site-search input[name="q"]'), function (input) {
            input.value = query;
        });
        if (!normalize(query)) {
            return; // mantém a mensagem padrão do template
        }

        document.title = '"' + query + '" — ' + document.title;
        status.textContent = 'Searching…';

        loadIndex().then(function (entries) {
            var outcome = searchGames(entries, query);
            var total = outcome.results.length;

            container.innerHTML = '';
            outcome.results.forEach(function (game) {
                container.appendChild(buildCard(game));
            });

            if (!total) {
                status.textContent = 'No games found for "' + query + '". Try another name or keyword, or browse the categories below.';
            } else if (outcome.partial) {
                status.textContent = 'No exact match for "' + query + '". Showing ' + total + (total === 1 ? ' game' : ' games') + ' that match some of your words.';
            } else {
                status.textContent = total + (total === 1 ? ' game' : ' games') + ' found for "' + query + '".';
            }

            if (window.paginateGrid) {
                window.paginateGrid(container, RESULTS_PAGE_SIZE);
            }
        }).catch(function () {
            status.textContent = 'Search is temporarily unavailable. Please try again in a moment.';
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        Array.prototype.forEach.call(document.querySelectorAll('form.site-search'), enhanceForm);
        renderResultsPage();
    });
})();
