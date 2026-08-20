<#
.SYNOPSIS
  Publica um pacote estatico do Atlas (Workers Static Assets) no Cloudflare,
  sem depender de wrangler/node - so PowerShell + a REST API do Cloudflare.

.DESCRIPTION
  Enumera os arquivos web reais do app (nao os arquivos internos do
  repositorio - ver $IncludeDirs/$IncludeFiles), calcula o hash de cada um,
  abre uma sessao de upload de assets, envia so os arquivos cujo hash ainda
  nao existe no Cloudflare, e publica uma nova versao do Worker apontando
  para o manifest resultante.

  Config do assets (html_handling/not_found_handling/serve_directly) e
  compatibility_date replicam exatamente o que ja estava publicado nos dois
  Workers em 2026-08 (confirmado via GET .../versions/{id} antes de escrever
  este script) - nao mude sem antes confirmar contra o Worker real.

.PARAMETER Target
  "homolog" (padrao, seguro) ou "producao". Resolve SourceDir/ScriptName
  automaticamente. Publicar em producao SEMPRE pede confirmacao explicita,
  mesmo com -Target producao passado.

.PARAMETER SourceDir
  Sobrescreve a pasta de origem (normalmente nao precisa - use -Target).

.PARAMETER ScriptName
  Sobrescreve o nome do Worker (normalmente nao precisa - use -Target).

.PARAMETER Confirm
  Obrigatorio quando -Target producao: precisa ser exatamente a frase
  'publicar em producao'. Nao usa Read-Host de proposito - prompts
  interativos nao funcionam em shells nao-interativos (inclusive o do
  proprio Claude Code), entao a confirmacao e sempre um parametro explicito,
  digitado por uma pessoa ou passado por um agente depois de um "sim" real
  em conversa - nunca com um valor padrao.

.EXAMPLE
  .\deploy-cloudflare.ps1
  Publica Atlas_Core_V2_2_0_DEV_HOMOLOGACAO em test-atlas (padrao seguro).

.EXAMPLE
  .\deploy-cloudflare.ps1 -Target producao -Confirm "publicar em producao"
  Publica Atlas_Core_V2_2_0_DEV em atlas (produção oficial).
#>
param(
  [ValidateSet("homolog", "producao")]
  [string]$Target = "homolog",
  [string]$SourceDir,
  [string]$ScriptName,
  [string]$Confirm = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$AccountId = "SEU_ACCOUNT_ID_CLOUDFLARE"
$CloudflareTokenPath = Join-Path $HOME ".atlas-secrets\cloudflare_token.txt"

$presets = @{
  homolog  = @{
    SourceDir  = $PSScriptRoot
    ScriptName = "test-atlas"
    ProjectRef = "SEU_PROJECT_REF_HOMOLOGACAO"
    PublicUrl  = "https://SEU-WORKER-HOMOLOGACAO.workers.dev"
  }
  producao = @{
    SourceDir  = $PSScriptRoot
    ScriptName = "atlas"
    ProjectRef = "SEU_PROJECT_REF_PRODUCAO"
    PublicUrl  = "https://SEU-WORKER-PRODUCAO.workers.dev"
  }
}

if (-not $SourceDir) { $SourceDir = $presets[$Target].SourceDir }
if (-not $ScriptName) { $ScriptName = $presets[$Target].ScriptName }

if ($ScriptName -ne $presets[$Target].ScriptName) {
  throw "Worker incompatível com o ambiente '$Target'. Esperado: $($presets[$Target].ScriptName)."
}

if (($Target -eq "producao" -or $ScriptName -eq "atlas") -and $Confirm -ne "publicar em producao") {
  Write-Warning "Voce esta publicando em PRODUCAO OFICIAL (Worker '$ScriptName')."
  Write-Warning "SourceDir: $SourceDir"
  Write-Output "Cancelado - passe -Confirm 'publicar em producao' para seguir (nao ha prompt interativo, ver ajuda do script)."
  exit 1
}

if (-not (Test-Path $SourceDir)) { throw "Pasta de origem nao encontrada: $SourceDir" }
if (-not (Test-Path $CloudflareTokenPath)) { throw "Token do Cloudflare nao encontrado em $CloudflareTokenPath" }

$configPath = Join-Path $SourceDir "config\config.js"
$appPath = Join-Path $SourceDir "js\v2.js"
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw "Configuracao ausente: $configPath" }
if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) { throw "Aplicacao ausente: $appPath" }
$configSource = [System.IO.File]::ReadAllText($configPath)
$projectMatch = [regex]::Match($configSource, 'https://([a-z0-9]+)\.supabase\.co', 'IgnoreCase')
if (-not $projectMatch.Success -or $projectMatch.Groups[1].Value -ne $presets[$Target].ProjectRef) {
  throw "O projeto Supabase configurado no pacote nao pertence ao ambiente '$Target'."
}
$appSource = [System.IO.File]::ReadAllText($appPath)
$buildMatch = [regex]::Match($appSource, "const ATLAS_BUILD = '([^']+)'", 'IgnoreCase')
if (-not $buildMatch.Success) { throw "ATLAS_BUILD nao encontrado em js\v2.js." }
$ExpectedBuild = $buildMatch.Groups[1].Value

$token = [System.IO.File]::ReadAllText($CloudflareTokenPath).Trim()
$base = "https://api.cloudflare.com/client/v4/accounts/$AccountId"

# So os arquivos web REAIS do app - nunca a pasta inteira do repositorio (que
# tem appscript/ com refs internas, supabase/ com SQL de migracao, tests/,
# docs/, package.json etc. - nada disso deve ficar publicamente acessivel
# pela URL do Worker). Confirmado contra o Worker real (curl direto nas
# rotas) antes de fixar esta lista - ver reference_atlas_paths na memoria.
$IncludeDirs = @("assets", "config", "css", "js")
$IncludeFiles = @("index.html", "manifest.webmanifest", "manual.html", "service-worker.js", "v2.html", "_headers")
$WorkerModuleName = "worker-security.js"
$WorkerModulePath = Join-Path $SourceDir $WorkerModuleName
if (-not (Test-Path -LiteralPath $WorkerModulePath -PathType Leaf)) {
  throw "Modulo de seguranca obrigatorio ausente no pacote: $WorkerModulePath"
}

$mimeMap = @{
  ".html" = "text/html"; ".js" = "application/javascript"; ".css" = "text/css"
  ".webmanifest" = "application/manifest+json"; ".json" = "application/json"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"; ".woff" = "font/woff"; ".woff2" = "font/woff2"; ".txt" = "text/plain"
  ".map" = "application/json"
}
function Get-MimeType($ext) {
  if ($mimeMap.ContainsKey($ext)) { return $mimeMap[$ext] }
  return "application/octet-stream"
}

Write-Output "Alvo: $Target | Worker: $ScriptName | Origem: $SourceDir"
Write-Output "Enumerando arquivos..."
$files = @()
foreach ($f in $IncludeFiles) {
  $p = Join-Path $SourceDir $f
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw "Arquivo obrigatorio ausente no pacote: $p" }
  $files += Get-Item -LiteralPath $p
}
foreach ($d in $IncludeDirs) {
  $p = Join-Path $SourceDir $d
  if (-not (Test-Path -LiteralPath $p -PathType Container)) { throw "Pasta obrigatoria ausente no pacote: $p" }
  $dirFiles = @(Get-ChildItem -LiteralPath $p -Recurse -File)
  if (-not $dirFiles.Count) { throw "Pasta obrigatoria vazia no pacote: $p" }
  $files += $dirFiles
}
if (-not $files.Count) { throw "Nenhum arquivo foi encontrado para publicacao." }
Write-Output "Total de arquivos: $($files.Count)"

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$manifest = @{}
$fileInfoByHash = @{}

foreach ($file in $files) {
  $rel = $file.FullName.Substring($SourceDir.Length).Replace("\", "/")
  if (-not $rel.StartsWith("/")) { $rel = "/$rel" }
  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  $hashBytes = $sha256.ComputeHash($bytes)
  $hashHex = ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLower().Substring(0, 32)
  $manifest[$rel] = @{ hash = $hashHex; size = $bytes.Length }
  $fileInfoByHash[$hashHex] = @{ path = $file.FullName; rel = $rel; bytes = $bytes }
}

$manifestJson = @{ manifest = $manifest } | ConvertTo-Json -Depth 12 -Compress

Write-Output "Abrindo sessao de upload de assets..."
$sessionResp = Invoke-RestMethod -Uri "$base/workers/scripts/$ScriptName/assets-upload-session" `
  -Headers @{ Authorization = "Bearer $token" } -Method Post -ContentType "application/json" -Body $manifestJson

if (-not $sessionResp.success) {
  Write-Output ($sessionResp | ConvertTo-Json -Depth 12 -Compress)
  throw "Falha ao abrir sessao de upload."
}

$uploadJwt = $sessionResp.result.jwt
$buckets = $sessionResp.result.buckets
Write-Output "Sessao aberta. Buckets pendentes de upload: $($buckets.Count)"

$completionJwt = $uploadJwt

if ($buckets.Count -gt 0) {
  $httpClient = New-Object System.Net.Http.HttpClient
  $httpClient.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $uploadJwt)

  foreach ($bucket in $buckets) {
    $content = New-Object System.Net.Http.MultipartFormDataContent
    foreach ($hash in $bucket) {
      $info = $fileInfoByHash[$hash]
      $ext = [System.IO.Path]::GetExtension($info.path)
      $mime = Get-MimeType $ext
      $b64 = [System.Convert]::ToBase64String($info.bytes)
      $partBytes = [System.Text.Encoding]::UTF8.GetBytes($b64)
      $part = New-Object System.Net.Http.ByteArrayContent(,$partBytes)
      $part.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($mime)
      $part.Headers.Add("Content-Encoding", "base64")
      $content.Add($part, $hash, $hash)
    }
    $uploadResp = $httpClient.PostAsync("$base/workers/assets/upload?base64=true", $content).Result
    $uploadBody = $uploadResp.Content.ReadAsStringAsync().Result
    if (-not $uploadResp.IsSuccessStatusCode) {
      Write-Output $uploadBody
      throw "Falha ao enviar bucket de assets."
    }
    $parsed = $uploadBody | ConvertFrom-Json
    if ($parsed.success -eq $false) {
      Write-Output $uploadBody
      throw "Cloudflare recusou o upload do bucket."
    }
    if ($parsed.result -and $parsed.result.jwt) {
      $completionJwt = $parsed.result.jwt
    }
    Write-Output "Bucket de $($bucket.Count) arquivo(s) enviado."
  }
  $httpClient.Dispose()
} else {
  Write-Output "Todos os arquivos ja existem no Cloudflare (mesmo hash); nenhum upload de conteudo necessario."
}

Write-Output "Publicando nova versao do worker com o manifest de assets..."
$metadataTable = @{
  main_module = $WorkerModuleName
  compatibility_date = "2026-07-30"
  bindings = @(
    @{ name = "ASSETS"; type = "assets" }
  )
  assets = @{
    jwt = $completionJwt
    config = @{
      html_handling = "auto-trailing-slash"
      not_found_handling = "none"
      run_worker_first = $true
    }
  }
}
$metadataJson = $metadataTable | ConvertTo-Json -Depth 12 -Compress

$httpClient2 = New-Object System.Net.Http.HttpClient
$httpClient2.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)
$multipart = New-Object System.Net.Http.MultipartFormDataContent
$metaPart = New-Object System.Net.Http.StringContent($metadataJson, [System.Text.Encoding]::UTF8, "application/json")
$multipart.Add($metaPart, "metadata")
$workerSource = [System.IO.File]::ReadAllText($WorkerModulePath)
$workerPart = New-Object System.Net.Http.StringContent($workerSource, [System.Text.Encoding]::UTF8, "application/javascript+module")
$multipart.Add($workerPart, $WorkerModuleName, $WorkerModuleName)

$putResp = $httpClient2.PutAsync("$base/workers/scripts/$ScriptName", $multipart).Result
$putBody = $putResp.Content.ReadAsStringAsync().Result
Write-Output "Status do deploy: $($putResp.StatusCode)"
Write-Output $putBody
$httpClient2.Dispose()

if (-not $putResp.IsSuccessStatusCode) {
  throw "Falha ao publicar o worker."
}
$putResult = $putBody | ConvertFrom-Json
if ($putResult.success -eq $false) { throw "A API do Cloudflare recusou a publicacao." }

Write-Output "Validando a versao publicada no endereco do ambiente..."
$healthOk = $false
$healthError = ""
for ($attempt = 1; $attempt -le 8; $attempt++) {
  try {
    $cacheToken = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $rootResponse = Invoke-WebRequest -UseBasicParsing -Uri "$($presets[$Target].PublicUrl)/?atlas-health=$cacheToken" -Headers @{ "Cache-Control" = "no-cache" }
    $configResponse = Invoke-WebRequest -UseBasicParsing -Uri "$($presets[$Target].PublicUrl)/config/config.js?atlas-health=$cacheToken" -Headers @{ "Cache-Control" = "no-cache" }
    $appResponse = Invoke-WebRequest -UseBasicParsing -Uri "$($presets[$Target].PublicUrl)/js/v2.js?atlas-health=$cacheToken" -Headers @{ "Cache-Control" = "no-cache" }
    if ($rootResponse.StatusCode -ne 200 -or $configResponse.StatusCode -ne 200 -or $appResponse.StatusCode -ne 200) {
      throw "Uma das rotas de saude nao respondeu HTTP 200."
    }
    if ($configResponse.Content -notmatch [regex]::Escape($presets[$Target].ProjectRef)) {
      throw "O Worker publicado aponta para outro projeto Supabase."
    }
    if ($appResponse.Content -notmatch [regex]::Escape("const ATLAS_BUILD = '$ExpectedBuild'")) {
      throw "O Worker ainda nao esta servindo o build $ExpectedBuild."
    }
    if (($rootResponse.Headers['X-Content-Type-Options'] -join ',') -notmatch 'nosniff') {
      throw "Cabecalho X-Content-Type-Options ausente."
    }
    if ($Target -eq 'homolog' -and ($rootResponse.Headers['X-Robots-Tag'] -join ',') -notmatch 'noindex') {
      throw "A homologacao foi publicada sem bloqueio de indexacao."
    }
    $healthOk = $true
    break
  } catch {
    $healthError = $_.Exception.Message
    if ($attempt -lt 8) { Start-Sleep -Seconds 2 }
  }
}
if (-not $healthOk) { throw "Deploy aceito, mas a verificacao remota falhou: $healthError" }
Write-Output "DEPLOY_OK ($Target -> $ScriptName | build $ExpectedBuild verificado)"
