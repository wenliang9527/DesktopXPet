using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public class GenerateJumpStatic
{
    public static void Main(string[] args)
    {
        string[] skins = {
            @"d:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\skins\reze",
            @"d:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\skins\professional-team",
            @"d:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\skins\butterfly-swordsman",
            @"d:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\skins\butterfly-swordsman-hd"
        };

        foreach (string skin in skins)
        {
            string srcPath = System.IO.Path.Combine(skin, "idle.png");
            string dstPath = System.IO.Path.Combine(skin, "jump.png");
            using (Image src = Image.FromFile(srcPath))
            {
                int w = src.Width;
                int h = src.Height;
                using (Bitmap dst = new Bitmap(w, h))
                {
                    using (Graphics g = Graphics.FromImage(dst))
                    {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.Clear(Color.Transparent);
                        // 向上偏移,模拟起跳;整体轻微拉伸
                        int offsetY = -(int)(h * 0.08f);
                        float scaleY = 1.04f;
                        int newH = (int)(h * scaleY);
                        int y = h - newH + offsetY;
                        g.DrawImage(src, 0, y, w, newH);
                    }
                    dst.Save(dstPath, ImageFormat.Png);
                }
            }
            Console.WriteLine("Generated " + dstPath);
        }
    }
}
