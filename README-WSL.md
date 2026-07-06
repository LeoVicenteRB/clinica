# Sorri + Vida - Docker e WSL

Este projeto sobe o site, o portal admin e o banco Postgres com Docker Compose.

## O que precisa no WSL

- WSL 2 com Ubuntu instalado.
- Docker Desktop com integração WSL ativada, ou Docker Engine instalado dentro do Ubuntu.
- Git opcional, apenas se você for versionar.

## Colocar em `/var/www/html/clinica`

No PowerShell, copie a pasta gerada para o WSL:

```powershell
wsl mkdir -p /var/www/html/clinica
wsl cp -r /mnt/c/Users/leona/Documents/Codex/2026-07-06/em/outputs/clinica/. /var/www/html/clinica/
```

Se der permissão negada:

```bash
sudo mkdir -p /var/www/html/clinica
sudo chown -R $USER:$USER /var/www/html/clinica
```

Depois repita a cópia.

## Subir com Docker

Dentro do WSL:

```bash
cd /var/www/html/clinica
cp .env.example .env
nano .env
docker compose up -d --build
```

Abra:

- Site: `http://localhost:4173/`
- Admin: `http://localhost:4173/admin-sorrimaisvida/`

O painel real fica em `/admin-sorrimaisvida/painel`, mas essa rota é protegida pelo servidor. Sem login, ela redireciona para a tela de login.

## Variáveis importantes

Edite o arquivo `.env` antes de publicar:

```env
APP_PORT=4173
POSTGRES_DB=clinica
POSTGRES_USER=clinica
POSTGRES_PASSWORD=uma_senha_forte
ADMIN_USER=admin
ADMIN_PASSWORD=uma_senha_forte
RESET_ADMIN_PASSWORD_ON_START=false
```

## Comandos úteis

Ver status:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f web
```

Parar:

```bash
docker compose down
```

Parar e apagar o banco:

```bash
docker compose down -v
```

## Como os dados são salvos

O servidor cria automaticamente:

- `site_settings`: configurações do site em JSONB.
- `admin_users`: usuários do painel admin com senha criptografada por PBKDF2.

Tudo que o admin salva vai para o Postgres. Imagens enviadas pelo painel são salvas junto das configurações como data URL.

## Segurança do admin

- O painel `/admin-sorrimaisvida/painel` é protegido no backend.
- APIs de escrita exigem sessão válida.
- APIs de escrita também exigem token CSRF.
- A sessão usa cookie `HttpOnly`.
- Senhas não ficam no frontend.
- Senhas dos usuários são salvas com hash PBKDF2.
- O primeiro usuário é criado automaticamente com `ADMIN_USER` e `ADMIN_PASSWORD` do `.env`.
- Se precisar forçar reset da senha do admin existente, use temporariamente `RESET_ADMIN_PASSWORD_ON_START=true`, reinicie, entre com a nova senha e depois volte para `false`.

Depois de entrar no painel, use a aba **Usuários** para criar novos acessos.
