var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<roomService>();
builder.Services.AddSingleton<SessionService>();

var app = builder.Build();

app.UseStaticFiles();           // ← serves wwwroot/
app.MapHub<PockittHub>("/hub"); // ← handles WebSocket connections

app.Run();

