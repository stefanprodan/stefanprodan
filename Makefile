# Development tasks for the stefanprodan.com website (Astro app in site/).
# Run `make help` to list the available targets.

.DEFAULT_GOAL := help

SITE_DIR := site

.PHONY: install
install: ## Install site dependencies from the lockfile
	cd $(SITE_DIR) && npm ci

.PHONY: dev
dev: ## Start the Astro dev server with live reload
	cd $(SITE_DIR) && npm run dev

.PHONY: build
build: ## Build the site for production into site/dist
	cd $(SITE_DIR) && npm run build

.PHONY: preview
preview: ## Serve the production build locally
	cd $(SITE_DIR) && npm run preview

.PHONY: clean
clean: ## Remove the site build output
	rm -rf $(SITE_DIR)/dist

.PHONY: help
help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
