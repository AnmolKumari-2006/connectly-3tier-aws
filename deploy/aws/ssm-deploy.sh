#!/usr/bin/env bash
# =============================================================================
#  Deploys one tier of Connectly through AWS Systems Manager (Run Command).
#
#  Usage: ssm-deploy.sh <tier> <image-tag>      e.g. ssm-deploy.sh web 3f9c2ab
#
#  Runs "/usr/local/bin/connectly-deploy <image-tag>" on every running server
#  tagged Tier=<tier>, ONE SERVER AT A TIME (rolling deployment), and stops at
#  the first failure so a broken version never reaches every server.
#  No SSH and no open ports are needed: the SSM agent on each server picks the
#  command up over its outbound connection.
# =============================================================================
set -euo pipefail

TIER="${1:?usage: ssm-deploy.sh <tier> <image-tag>}"
TAG="${2:?usage: ssm-deploy.sh <tier> <image-tag>}"

echo "Deploying image tag '$TAG' to the '$TIER' tier..."
CMD_ID=$(aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --targets "Key=tag:Tier,Values=$TIER" \
  --parameters "commands=/usr/local/bin/connectly-deploy $TAG" \
  --max-concurrency "1" \
  --max-errors "0" \
  --timeout-seconds 600 \
  --comment "Connectly $TIER deploy $TAG" \
  --query "Command.CommandId" --output text)
echo "SSM command id: $CMD_ID"

STATUS="Pending"
for _ in $(seq 1 90); do
  read -r STATUS TARGETS DONE < <(aws ssm list-commands --command-id "$CMD_ID" \
    --query "Commands[0].[Status,TargetCount,CompletedCount]" --output text)
  echo "  status=$STATUS servers=$TARGETS completed=$DONE"
  case "$STATUS" in
    Success|Failed|Cancelled|TimedOut) break ;;
  esac
  sleep 10
done

echo "---- output from each server ----"
aws ssm list-command-invocations --command-id "$CMD_ID" --details \
  --query "CommandInvocations[].[InstanceId,Status,CommandPlugins[0].Output]" --output text || true

if [ "$STATUS" != "Success" ]; then
  echo "Deployment of the $TIER tier did not succeed (status: $STATUS)." >&2
  exit 1
fi
if [ "${TARGETS:-0}" = "0" ]; then
  echo "No running server is tagged Tier=$TIER, so nothing was deployed." >&2
  exit 1
fi
echo "The $TIER tier now runs image tag $TAG on $TARGETS server(s)."