package database

import (
	"context"
	"fmt"
	"log"
	"os"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func InitMongoDB() *mongo.Client {
	uri := os.Getenv("MONGODB_URI")

	if uri == "" {
		log.Fatal("Set your 'MONGODB_URI' environment variable.")
	}

	serverAPI := options.ServerAPI(options.ServerAPIVersion1)

	opts := options.Client().ApplyURI(uri).SetServerAPIOptions(serverAPI)

	client, err := mongo.Connect(opts)

	if err != nil {
		panic(err)
	}

	var result bson.M
	if err := client.Database("anime_recommendation").RunCommand(context.TODO(), bson.D{{Key: "ping", Value: 1}}).Decode(&result); err != nil {
		panic(err)
	}

	fmt.Println("Pinged the deployment.You successfully connected to MongoDB")
	return client

}
