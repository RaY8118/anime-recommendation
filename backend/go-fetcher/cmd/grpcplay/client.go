package main

import (
	"context"
	"log"
	"time"

	pb "github.com/RaY8118/anime-recommendation/backend/go-fetcher/gen/anime/v1"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/proto"
)

func main() {
	conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to create client: %v", err)
	}
	defer conn.Close()

	client := pb.NewIngestServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	stream, err := client.IngestAnimes(ctx)
	if err != nil {
		log.Fatalf("could not open ingest stream: %v", err)
	}

	for _, req := range []*pb.IngestAnimeRequest{
		fmaBrotherhood(),
		deathNote(),
		steinsGate(),
	} {
		if err := stream.Send(req); err != nil {
			log.Fatalf("failed to send anime %d: %v", req.GetId(), err)
		}
	}

	summary, err := stream.CloseAndRecv()
	if err != nil {
		log.Fatalf("ingest failed: %v", err)
	}

	log.Printf("received=%d inserted=%d embedded=%d failed=%d — %s",
		summary.GetReceived(), summary.GetInserted(), summary.GetEmbedded(),
		summary.GetFailed(), summary.GetMessage())
	if len(summary.GetIds()) > 0 {
		log.Printf("ingested anime ids: %v", summary.GetIds())
	}
}

func fmaBrotherhood() *pb.IngestAnimeRequest {
	return &pb.IngestAnimeRequest{
		Id: 5114,
		Title: &pb.Title{
			TitleRomaji:  proto.String("Hagane no Renkinjutsushi: Fullmetal Alchemist"),
			TitleEnglish: proto.String("Fullmetal Alchemist: Brotherhood"),
		},
		Description:  proto.String("After a horrific alchemy experiment goes wrong..."),
		Genres:       []string{"Adventure", "Drama", "Fantasy"},
		AverageScore: proto.Int32(91),
		Episodes:     proto.Int32(64),
		Duration:     proto.Int32(24),
		Season:       proto.String("SPRING"),
		SeasonYear:   proto.Int32(2009),
		Status:       proto.String("FINISHED"),
		Source:       proto.String("MANGA"),
		Studios:      []string{"Bones"},
		CoverImage:   &pb.CoverImage{Large: proto.String("https://...")},
		Popularity:   1,
	}
}

func deathNote() *pb.IngestAnimeRequest {
	return &pb.IngestAnimeRequest{
		Id: 1535,
		Title: &pb.Title{
			TitleRomaji:  proto.String("Death Note"),
			TitleEnglish: proto.String("Death Note"),
		},
		Genres:      []string{"Mystery", "Psychological", "Thriller"},
		Season:      proto.String("FALL"),
		SeasonYear:  proto.Int32(2006),
		Status:      proto.String("FINISHED"),
		Description: proto.String("A high school student discovers a notebook..."),
		Episodes:    proto.Int32(37),
		Popularity:  2,
	}
}

func steinsGate() *pb.IngestAnimeRequest {
	return &pb.IngestAnimeRequest{
		Id: 32281,
		Title: &pb.Title{
			TitleRomaji:  proto.String("Steins;Gate"),
			TitleEnglish: proto.String("Steins;Gate"),
		},
		Genres:      []string{"Drama", "Sci-Fi", "Thriller"},
		Season:      proto.String("SPRING"),
		SeasonYear:  proto.Int32(2011),
		Status:      proto.String("FINISHED"),
		Description: proto.String("Eccentric scientist in a basement lab texts the past..."),
		Episodes:    proto.Int32(24),
		Popularity:  3,
	}
}
