namespace Pockitt.Models;

public class Room
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Geohash { get; set; } = string.Empty;
    public List<User> Users { get; set; } = new();
    public List<Message> Messages { get; set; } = new();
}