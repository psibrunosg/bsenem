#!/usr/bin/env bash
# Publica o frontend na VPS (estudos.bssaude.com.br).
#
# A VPS não roda Node: o build sai daqui e vai para
# /opt/projects/bsenem/releases/<sha>, e o symlink `current` — que é o root do
# nginx dentro do container deploy-frontend-1 — passa a apontar para ele.
# Rollback é trocar o symlink de volta para o release anterior.
#
# O symlink tem que ser RELATIVO: o nginx enxerga a árvore montada em
# /var/www/bsenem, então um alvo absoluto do host (/opt/projects/...) não
# existe dentro do container e o try_files entra em loop, devolvendo 500.
#
#   bash scripts/deploy-vps.sh              # publica o HEAD atual
#   bash scripts/deploy-vps.sh --rollback   # volta para o release anterior
#
# Requer acesso SSH ao host (~/.ssh/config: Host oraclevps2).
set -euo pipefail

HOST="${DEPLOY_HOST:-oraclevps2}"
ROOT="${DEPLOY_ROOT:-/opt/projects/bsenem}"
CONTAINER="${DEPLOY_CONTAINER:-deploy-frontend-1}"

remote() { ssh -o ConnectTimeout=20 "$HOST" "$@"; }

current_target() { remote "readlink $ROOT/current"; }

reload_nginx() {
  # O nginx guarda descritores abertos; sem o reload ele continua servindo o
  # release antigo depois da troca do symlink.
  remote "sudo docker exec $CONTAINER nginx -s reload"
}

if [[ "${1:-}" == "--rollback" ]]; then
  previous="$(remote "cat $ROOT/releases/.previous" 2>/dev/null || true)"
  [[ -n "$previous" ]] || { echo "Sem release anterior registrado em releases/.previous"; exit 1; }
  echo "Voltando para $previous"
  remote "cd $ROOT && sudo ln -sfn releases/$previous current"
  reload_nginx
  echo "Rollback concluído: $(current_target)"
  exit 0
fi

sha="$(git rev-parse --short HEAD)"
dirty="$(git status --porcelain --untracked-files=no)"
[[ -z "$dirty" ]] || { echo "Árvore suja — commite antes de publicar."; exit 1; }

echo ">>> Build (sem BASE_PATH: a VPS serve na raiz do domínio)"
unset BASE_PATH || true
npm run build

echo ">>> Enviando dist/ para $HOST:$ROOT/releases/$sha"
previous="$(basename "$(current_target)")"
remote "sudo mkdir -p $ROOT/releases/$sha && sudo chown \$(whoami) $ROOT/releases/$sha"
tar czf - -C dist . | remote "tar xzf - -C $ROOT/releases/$sha"

echo ">>> Apontando current -> releases/$sha (anterior: $previous)"
remote "echo $previous | sudo tee $ROOT/releases/.previous > /dev/null"
remote "cd $ROOT && sudo ln -sfn releases/$sha current"
reload_nginx

echo ">>> Publicado: $(current_target)"
curl -sS -o /dev/null -w "https://estudos.bssaude.com.br/ -> HTTP %{http_code}\n" https://estudos.bssaude.com.br/
