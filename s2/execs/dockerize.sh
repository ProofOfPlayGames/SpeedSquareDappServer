docker build . -t speed_square_dapp_server
docker stop speed_square_dapp_server_container
docker rm speed_square_dapp_server_container
docker run --network=host --name speed_square_dapp_server_container -p 49160:3004 -d speed_square_dapp_server
