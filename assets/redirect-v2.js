// Redirecionamento de compatibilidade: v2.html era o nome antigo da entrada
// do Atlas. Fica como um script externo (nao inline) de proposito - um script
// inline aqui exigiria um hash extra na CSP (script-src) de worker-security.js
// e _headers, e o hash de v2.html jamais foi adicionado la, entao esse
// redirecionamento quebrava silenciosamente (bloqueado pela propria CSP).
// Como script externo 'self', nao precisa de hash nenhum.
location.replace('index.html' + location.search + location.hash);
