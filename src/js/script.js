function open_fullscreen() {
    var elem = document.getElementById("game-area");
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
}

// Formulário de contato sem serviço externo: quando CONTACT_FORM_ACTION não
// está configurada, o formulário vem com data-mailto e, ao enviar, abre o
// aplicativo de e-mail do visitante com assunto e mensagem já preenchidos.
document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('form[data-mailto]');
    if (!form) {
        return;
    }
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        var field = function (name) {
            return form.elements.namedItem(name).value.trim();
        };
        var body = field('message') + '\n\n— ' + field('name') + ' <' + field('email') + '>';
        window.location.href = 'mailto:' + form.getAttribute('data-mailto') +
            '?subject=' + encodeURIComponent(field('subject')) +
            '&body=' + encodeURIComponent(body);
    });
});
