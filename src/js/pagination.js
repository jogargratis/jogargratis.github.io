// Pagina, no navegador, qualquer grade de itens marcada com data-paginate="N".
// Não remove nada do HTML: todos os links continuam presentes no DOM (bons
// para SEO/crawlers), apenas ficam ocultos (hidden) fora da página atual.
// Não depende de jQuery, funciona com Bootstrap só pelo CSS (.pagination).
//
// Os números aparecem em blocos de 10 (mude com data-paginate-window="N"):
// nas páginas 1–10 aparecem 1…10, nas páginas 11–20 aparecem 11…20, etc.
// Os botões "…" saltam para os 10 números anteriores/seguintes, e a primeira
// e a última página ficam sempre acessíveis. Assim um catálogo com 100
// páginas mostra no máximo 10 números, não 100.
//
// A página atual fica no endereço (#page-N): ao voltar de um jogo com o botão
// Voltar do navegador, o visitante continua na mesma página da lista.
(function () {
    var DEFAULT_WINDOW = 10;
    var HASH_PATTERN = /^#page-(\d+)$/;

    function pageFromHash() {
        var match = HASH_PATTERN.exec(window.location.hash);
        return match ? parseInt(match[1], 10) : 1;
    }

    function rememberPage(page) {
        if (!window.history || !window.history.replaceState) {
            return;
        }
        var url = window.location.pathname + window.location.search + (page > 1 ? '#page-' + page : '');
        window.history.replaceState(null, '', url);
    }

    function paginate(container, pageSize) {
        // Permite paginar de novo a mesma grade (ex.: nova busca na página de resultados).
        if (container.paginationNav) {
            container.paginationNav.parentNode.removeChild(container.paginationNav);
            container.paginationNav = null;
        }

        var items = Array.prototype.slice.call(container.children);
        items.forEach(function (item) {
            item.hidden = false;
        });
        var totalPages = Math.ceil(items.length / pageSize);
        if (totalPages <= 1) {
            return;
        }
        var windowSize = parseInt(container.getAttribute('data-paginate-window'), 10) || DEFAULT_WINDOW;

        var nav = document.createElement('nav');
        nav.className = 'pagination-nav my-4';
        nav.setAttribute('aria-label', 'Pagination');

        var ul = document.createElement('ul');
        ul.className = 'pagination justify-content-center flex-wrap';
        nav.appendChild(ul);
        container.insertAdjacentElement('afterend', nav);
        container.paginationNav = nav;

        var currentPage = 1;

        function showItems(page) {
            items.forEach(function (item, index) {
                item.hidden = Math.floor(index / pageSize) + 1 !== page;
            });
        }

        function pageItem(label, targetPage, opts) {
            opts = opts || {};
            var li = document.createElement('li');
            li.className = 'page-item' + (opts.active ? ' active' : '') + (opts.disabled ? ' disabled' : '');

            var a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#page-' + targetPage;
            a.textContent = label;

            if (opts.title) {
                a.title = opts.title;
                a.setAttribute('aria-label', opts.title);
            }
            if (opts.disabled) {
                a.setAttribute('tabindex', '-1');
                a.setAttribute('aria-disabled', 'true');
            }
            if (opts.active) {
                a.setAttribute('aria-current', 'page');
            }

            a.addEventListener('click', function (event) {
                event.preventDefault();
                if (!opts.disabled && !opts.active) {
                    goTo(targetPage, true);
                }
            });

            li.appendChild(a);
            return li;
        }

        function renderControls() {
            ul.innerHTML = '';
            var start = Math.floor((currentPage - 1) / windowSize) * windowSize + 1;
            var end = Math.min(start + windowSize - 1, totalPages);

            ul.appendChild(pageItem('«', currentPage - 1, { disabled: currentPage === 1, title: 'Previous page' }));
            if (start > 1) {
                ul.appendChild(pageItem('1', 1, { title: 'First page' }));
                if (start - 1 > 1) {
                    ul.appendChild(pageItem('…', start - 1, { title: 'Previous ' + windowSize + ' pages' }));
                }
            }
            for (var p = start; p <= end; p++) {
                ul.appendChild(pageItem(String(p), p, { active: p === currentPage }));
            }
            if (end < totalPages) {
                if (end + 1 < totalPages) {
                    ul.appendChild(pageItem('…', end + 1, { title: 'Next ' + windowSize + ' pages' }));
                }
                ul.appendChild(pageItem(String(totalPages), totalPages, { title: 'Last page' }));
            }
            ul.appendChild(pageItem('»', currentPage + 1, { disabled: currentPage === totalPages, title: 'Next page' }));
        }

        // fromUser: só rola a tela e grava o #page-N quando o visitante clica.
        // No carregamento inicial a página não deve pular sozinha para a grade
        // (escondia a introdução e o anúncio do topo).
        function goTo(page, fromUser) {
            if (page < 1 || page > totalPages) {
                return;
            }
            currentPage = page;
            showItems(currentPage);
            renderControls();
            if (fromUser) {
                rememberPage(currentPage);
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        goTo(Math.max(1, Math.min(pageFromHash(), totalPages)), false);
    }

    // Exposto para grades preenchidas depois do carregamento (resultados da busca).
    window.paginateGrid = paginate;

    document.addEventListener('DOMContentLoaded', function () {
        Array.prototype.forEach.call(document.querySelectorAll('[data-paginate]'), function (container) {
            var pageSize = parseInt(container.getAttribute('data-paginate'), 10) || 50;
            paginate(container, pageSize);
        });
    });
})();
