.DEFAULT_GOAL := help

SHELL := bash

DOCKERHOST := $(shell ifconfig | grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" | grep -v 127.0.0.1 | awk '{ print $$2 }' | cut -f2 -d: | head -n1)

.PHONY: help
help:
	@echo ""
	@echo "OPERATE:"
	@echo "build                    Build images"
	@echo "up                       Create and start all containers"
	@echo "down                     Remove all containers and volumes"
	@echo "restart                  Remove, re-create, and start containers"
	@echo "rebuild                  Remove, build, then start containers"
	@echo ""
	@echo "DEBUGGING:"
	@echo "logs                     Re-attach to running container logs"
	@echo "log                      Re-attach to specified running container log"
	@echo "ps                       List running container info"
	@echo "bash                     Bash inside a container (default=node)"
	@echo ""
	@echo "MAINTENANCE:"
	@echo "clean                    Remove dangling images and exited containers"
	@echo "clear_logs               Truncate Docker logs"
	@echo ""

.PHONY: build
build:
	docker-compose build
	@echo "All built 🏛"

.PHONY: up
up:
	DOCKERHOST=$(DOCKERHOST) docker-compose up -d
	@make create_job
	@make logs

.PHONY: down
down:
	docker-compose down --volumes

.PHONY: restart
restart:
	@echo "make down ==> make up"
	@make down
	@make up

.PHONY: rebuild
rebuild:
	@echo "make down ==> make build ==> make up"
	@make down
	@make build
	@make up

.PHONY: logs
logs:
	docker-compose logs -f 

.PHONY: log
log:
	@if test -z $(name); then\
	    echo "";\
	    echo "Please enter a container name as argument.";\
	    echo "";\
	    echo " e.g. 'make log name=node'";\
	    echo "";\
	    echo "or use 'make logs' to attach to all container logs.";\
	    echo "";\
	    echo "Available container names are:";\
	    echo "  node";\
	    echo "  db";\
	    echo "  adapter";\
	else\
	  docker-compose logs -f $(name);\
	fi

.PHONY: bash
bash:
	@if test -z $(name); then\
	    echo "bash in node container:";\
	    docker-compose exec node bash;\
	else\
	    echo "bash in $(name) container:";\
	    docker-compose exec $(name) bash;\
	fi

.PHONY: clean
clean:
	@echo "Deleting exited containers..."
	docker ps -a -q -f status=exited | xargs docker rm -v
	@echo "Deleting dangling images..."
	docker images -q -f dangling=true | xargs docker rmi
	@echo "All clean 🛀"

# https://stackoverflow.com/a/51866793/1175053
.PHONY: clear_logs
clear_logs:
	docker run -it --rm --privileged --pid=host alpine:latest nsenter -t 1 -m -u -n -i -- sh -c 'truncate -s0 /var/lib/docker/containers/*/*-json.log'

.PHONY: ps
ps:
	docker-compose ps

.PHONY: create_job
create_job:
	@docker-compose exec node bash -c "\
		while !</dev/tcp/node/6688; do sleep 5; done; \
		chainlink admin login -f /docker/api && \
		if !(chainlink jobs list | grep -q fluxmonitor); then \
			chainlink bridges create /docker/bridge.json; \
			chainlink jobs create /docker/tvlAgg-spec.json; \
		fi \
	"

# original name of repo is external-adapter-js
CHAINLINK_REPO_FOLDER := "./chainlink-tvl-adapter"
CHAINLINK_REPO_URL := "git@github.com:smartcontractkit/external-adapters-js.git"

.PHONY: clone_chainlink_repo
clone_chainlink_repo:
	@if [ ! -d "$(CHAINLINK_REPO_FOLDER)" ]; then \
    	git clone "$(CHAINLINK_REPO_URL)" "$(CHAINLINK_REPO_FOLDER)"; \
	else \
    	cd "$(CHAINLINK_REPO_FOLDER)"; \
    	git pull "$(CHAINLINK_REPO_URL)"; \
		cd -;\
	fi

.PHONY: test_chainlink
test_chainlink:
    # $(shell while netstat -lnt | awk '$$4 ~ /:8545$$/ {exit 1}'; do sleep 5; done)
	while !</dev/tcp/localhost/8545; do sleep 5; done
	# make up
	DOCKERHOST=$(DOCKERHOST) docker-compose up -d
	@make create_job
	@echo "testing chainlink.... woohoo!"
	make down

.PHONY: fork_mainnet
fork_mainnet:
	yarn fork:mainnet > /dev/null &

.PHONY: CI_tests
CI_tests: fork_mainnet test_chainlink
	# yarn test:unit
	# yarn test:integration
	# make clone_chainlink_repo
    kill -9 $$(lsof -t -i :8545)
