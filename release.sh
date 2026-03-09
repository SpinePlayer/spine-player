#!/usr/bin/env bash

# ----------------------------------------------------------------------------
# 发布脚本
# 1. 可选地根据参数 bump 版本号 (patch / minor / major / pre...)
# 2. 安装依赖
# 3. 清理旧产物并执行构建
# 4. 发布到 npm (默认公开包)
# ----------------------------------------------------------------------------

set -euo pipefail

# 颜色输出帮助函数
function info()  { echo -e "\033[32m[INFO]\033[0m  $1"; }
function warn()  { echo -e "\033[33m[WARN]\033[0m  $1"; }
function error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

# 跳转到脚本所在目录（即仓库根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ----------------------------------------------------------------------------
# 安装依赖
# ----------------------------------------------------------------------------
# info "Installing dependencies (pnpm)..."
# pnpm install --frozen-lockfile

# ----------------------------------------------------------------------------
# 构建项目
# ----------------------------------------------------------------------------
info "Cleaning previous build..."
rm -rf dist

info "Building library..."
pnpm run build

# ----------------------------------------------------------------------------
# 版本号处理
# ----------------------------------------------------------------------------
RELEASE_TYPE="${1-}" # 如果没有传参则不自动 bump
if [[ -n "$RELEASE_TYPE" ]]; then
  info "Bumping version: $RELEASE_TYPE"
  npm version "$RELEASE_TYPE" --no-git-tag-version
else
  warn "未指定版本号，跳过 npm version。可使用: ./release.sh patch|minor|major"
fi

# ----------------------------------------------------------------------------
# 发布到 npm
# ----------------------------------------------------------------------------
info "镜像源登录检测..."

npm_registry="https://registry.npmjs.org/"

# 检测多个镜像源登录状态
check_npm_login() {
  local registries=("$npm_registry")
  local all_logged_in=true
  
  for registry in "${registries[@]}"; do
    if npm whoami --registry="$registry" &> /dev/null; then
      echo "✅ 已登录镜像源: $registry"
    else
      echo "❌ 未登录镜像源: $registry"
      all_logged_in=false
    fi
  done
  
  if [ "$all_logged_in" = false ]; then
    error "需要登录所有镜像源才能发布，请执行以下命令："
    echo "  npm login --registry=$npm_registry"
    exit 1
  fi
}

# 确保已登录
check_npm_login

# 发布
info "开始发布..."
npm publish --registry $npm_registry
info "发布完成！"

info "🎉 已全部发布完成！"
