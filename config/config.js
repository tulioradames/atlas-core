// Atlas Core configuration
// Versão oficial do produto: V 1.4.1 Oficial.
window.ATNX_CONFIG = {
    APP_NAME: "Atlas",
    APP_TAGLINE: "Smart Field Management",
    VERSION: "V 1.4.1 Oficial",

    // Preencha com os dados públicos do seu projeto Supabase.
    SUPABASE_URL: "",
    SUPABASE_KEY: "",

    // Web Apps separados porque Documentação e Expansões ficam em Drives/contas diferentes.
    // Documentação deve usar a implantação publicada pela conta dona do Drive de Documentação.
    GOOGLE_DRIVE_DOCUMENTACAO_UPLOAD_URL: "",
    // Expansões deve usar a implantação publicada pela conta dona do Drive de Expansões.
    GOOGLE_DRIVE_EXPANSOES_UPLOAD_URL: "",
    // Legado: mantido apenas como fallback para versões antigas.
    GOOGLE_DRIVE_UPLOAD_URL: "",
    GOOGLE_DRIVE_PROXY_URL: "", // V1.3.3.7: deixa vazio para usar Apps Script direto por JSONP

    // Drive exclusivo do módulo Documentação Rede Geral / Obras.
    GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_URL: "",
    GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID: "",
    // Alias legado usado em algumas telas antigas. Mantém Documentação apontando para a mesma pasta exclusiva.
    GOOGLE_DRIVE_FOLDER_URL: "",
    GOOGLE_DRIVE_FOLDER_ID: "",

    // Drive exclusivo do módulo Expansões.
    GOOGLE_DRIVE_EXPANSOES_FOLDER_URL: "",
    GOOGLE_DRIVE_EXPANSOES_FOLDER_ID: "",

    // Manutenção de Redes usa controle interno/manual de tickets Voalle.
    // Nenhum token do Voalle deve ser colocado neste arquivo público.
    AUTH_REQUIRED: true,
    AUTH_VERSION: "1.4.1 Oficial",
    LIMITE_UPLOAD_MB: 15
};
