namespace Pockitt.Models;

public class User
{
    public string ConnectionId { get; set; } = string.Empty;
    public string SessionToken { get; set; } = Guid.NewGuid().ToString();
    public string Username { get; set; } = string.Empty;
    public string Geohash { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
}