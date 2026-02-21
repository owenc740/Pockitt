using Pockitt.Hubs;
using Pockitt.Services;

var builder = WebApplication.CreateBuilder(args);

// Register Services
builder.Services.AddSingleton<RoomService>();
builder.Services.AddSignalR();

var app = builder.Build();

// Serves static files from wwwroot/
app.UseDefaultFiles();
app.UseStaticFiles();

// Map SignalR Hub (WebSocket Connections)
app.MapHub<RoomAssignHub>("/hub");

app.Run();

