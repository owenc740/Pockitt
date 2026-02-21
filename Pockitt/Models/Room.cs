namespace Pockitt.Models;

public class Room
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public List<User> Users { get; set; } = new();
    public List<Message> Messages { get; set; } = new();
}