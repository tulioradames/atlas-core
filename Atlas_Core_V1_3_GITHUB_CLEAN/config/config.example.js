// Atlas Core configuration
// Arquivo seguro para versionamento público.
// Preencha os valores abaixo somente no seu ambiente de produção.
window.ATNX_CONFIG = {
    APP_NAME: "Atlas",
    APP_TAGLINE: "Smart Field Management",
    VERSION: "V 1.3",

    // Supabase
    // Ex.: https://SEU-PROJETO.supabase.co
    SUPABASE_URL: "",
    // Use apenas a chave pública/anon/publishable. Nunca use service_role no front-end.
    SUPABASE_KEY: "",

    // Google Drive / Apps Script
    // URL do Web App publicado no Apps Script, se não usar proxy.
    GOOGLE_DRIVE_UPLOAD_URL: "",
    // Proxy interno do Cloudflare Worker.
    GOOGLE_DRIVE_PROXY_URL: "/api/drive",

    // Pasta raiz usada pelo módulo Documentação Rede Geral.
    GOOGLE_DRIVE_FOLDER_URL: "",
    GOOGLE_DRIVE_FOLDER_ID: "",

    // Pasta raiz usada pelo módulo Expansões.
    GOOGLE_DRIVE_EXPANSOES_FOLDER_URL: "",
    GOOGLE_DRIVE_EXPANSOES_FOLDER_ID: "",

    LIMITE_UPLOAD_MB: 15
};
