$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ((Get-Location).Path -ne $projectRoot) { throw 'Ejecuta desde la raíz del repositorio académico.' }
$runtimePath = Join-Path $projectRoot '.runtime'
$dataPath = Join-Path $runtimePath 'postgres'
$pgBin = if ($env:ACADEMIC_PG_BIN) { $env:ACADEMIC_PG_BIN } else { 'C:\Program Files\PostgreSQL\18\bin' }
if (!(Test-Path -LiteralPath (Join-Path $pgBin 'initdb.exe'))) { throw 'Instala los binarios PostgreSQL o define ACADEMIC_PG_BIN. No se usará ningún servicio existente.' }
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$envPath = Join-Path $projectRoot '.env'
if (!(Test-Path -LiteralPath $envPath)) {
  $pgPassword = [guid]::NewGuid().ToString('N')
  $mongoPassword = [guid]::NewGuid().ToString('N')
  @"
POSTGRES_USER=academic
POSTGRES_PASSWORD=$pgPassword
POSTGRES_DB=barberbook_hito3
MONGO_USER=academic
MONGO_PASSWORD=$mongoPassword
DATABASE_URL=postgresql://academic:${pgPassword}@127.0.0.1:55433/barberbook_hito3
MONGODB_URI=mongodb://academic:${mongoPassword}@127.0.0.1:27028/?authSource=admin
MONGODB_DATABASE=barberbook_hito3
API_PORT=3003
API_HOST=127.0.0.1
FRONTEND_ORIGIN=http://localhost:5174
VITE_API_URL=/api
"@ | Set-Content -LiteralPath $envPath -Encoding ASCII
  Write-Output 'Creado .env local con contraseñas aleatorias; no se muestran.'
}
$settings = @{}
Get-Content -LiteralPath $envPath | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.*)$') { $settings[$matches[1]] = $matches[2] } }
$uri = [Uri]$settings['DATABASE_URL']
if ($uri.Host -ne '127.0.0.1' -or $uri.Port -ne 55433 -or $uri.AbsolutePath -ne '/barberbook_hito3') { throw 'El inicio nativo requiere la base aislada en 127.0.0.1:55433/barberbook_hito3.' }
$env:PGPASSWORD = $settings['POSTGRES_PASSWORD']
if (!(Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
  $passwordFile = Join-Path $runtimePath 'postgres-init-password.txt'
  $settings['POSTGRES_PASSWORD'] | Set-Content -LiteralPath $passwordFile -Encoding ASCII
  & (Join-Path $pgBin 'initdb.exe') -D $dataPath -U academic --auth=scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar el clúster aislado.' }
}
& (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath status *> $null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath -l (Join-Path $runtimePath 'postgres.log') -o '-p 55433 -h 127.0.0.1' -w start
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL académico. Revisa .runtime/postgres.log.' }
}
$dbExists = & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p 55433 -U academic -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='barberbook_hito3'"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo conectar al clúster aislado.' }
if ($dbExists -ne '1') {
  & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p 55433 -U academic barberbook_hito3
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base académica.' }
}
$env:PGPASSWORD = $null
Write-Output 'PostgreSQL académico listo en 127.0.0.1:55433. Iniciando MongoDB autenticado en 127.0.0.1:27028.'
node scripts/local-mongo.js
