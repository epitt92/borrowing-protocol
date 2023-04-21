#bin/bash
kubectl -n ipfs port-forward ipfs-cluster-0 5001:5001 &
kubectl -n qa port-forward graphprotocol-node-index-manual-666f995d8d-69r2j 8020:8020 &
kubectl -n qa port-forward graphprotocol-node-index-manual-666f995d8d-69r2j 8030:8030 &
kubectl -n qa port-forward graphprotocol-node-index-manual-666f995d8d-69r2j 8000:8000 &
kubectl -n postgres port-forward acid-nonprod-0 5432:5432 &
