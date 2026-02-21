namespace Pockitt.Models;

public class User
{
    public string ConnectionId { get; set; } = string.Empty;
    public string SessionToken { get; set; } = Guid.NewGuid().ToString();
    public string Username { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string RoomId { get; set; } = string.Empty;
}