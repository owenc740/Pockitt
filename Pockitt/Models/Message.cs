namespace Pockitt.Models;

public enum MessageType
{
    Text,
    Drawing
}

public class Message
{
    public string Username { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public MessageType Type { get; set; } = MessageType.Text;
}