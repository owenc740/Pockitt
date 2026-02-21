namespace Pockitt.Models;

public enum NameColor
{
    Default, // Black (light mode only currently)
    Red,
    Green,
    Blue,
    Yellow,
    Orange,
    Purple,
    Pink,
    Brown
}

public enum UserPhoto
{
    One,
    Two,
    Three,
}

public class User
{
    public string ConnectionId { get; set; } = string.Empty;
    public string SessionToken { get; set; } = Guid.NewGuid().ToString();
    public string Username { get; set; } = string.Empty;
    public NameColor UserNameColor { get; set; } = NameColor.Default;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string RoomId { get; set; } = string.Empty;
}