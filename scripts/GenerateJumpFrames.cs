using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public class GenerateJumpFrames
{
    public static void Main(string[] args)
    {
        string root = @"d:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\skins\default-cat";
        string srcPath = System.IO.Path.Combine(root, "idle.png");
        string dstPath = System.IO.Path.Combine(root, "jump.png");

        using (Image src = Image.FromFile(srcPath))
        {
            int frameW = 128;
            int frameH = 128;

            using (Bitmap frame1 = new Bitmap(frameW, frameH))
            {
                using (Graphics g0 = Graphics.FromImage(frame1))
                {
                    g0.DrawImage(src, new Rectangle(0, 0, frameW, frameH), new Rectangle(0, 0, frameW, frameH), GraphicsUnit.Pixel);
                }

                using (Bitmap dst = new Bitmap(frameW * 4, frameH))
                {
                    using (Graphics g = Graphics.FromImage(dst))
                    {
                        g.InterpolationMode = InterpolationMode.NearestNeighbor;
                        g.PixelOffsetMode = PixelOffsetMode.Half;
                        g.Clear(Color.Transparent);

                        // 蹲下蓄力
                        DrawFrame(g, frame1, 0, frameW, frameH, 1.0f, 0.85f, 0);
                        // 起跳伸展
                        DrawFrame(g, frame1, 1, frameW, frameH, 1.0f, 1.05f, -6);
                        // 空中
                        DrawFrame(g, frame1, 2, frameW, frameH, 1.0f, 1.0f, -14);
                        // 落地缓冲
                        DrawFrame(g, frame1, 3, frameW, frameH, 1.0f, 0.92f, 0);
                    }
                    dst.Save(dstPath, ImageFormat.Png);
                }
            }
        }
        Console.WriteLine("Generated " + dstPath);
    }

    static void DrawFrame(Graphics g, Bitmap img, int idx, int fw, int fh, float sx, float sy, int oy)
    {
        g.TranslateTransform(idx * fw + fw / 2f, fh + oy);
        g.ScaleTransform(sx, sy);
        g.DrawImage(img, -fw / 2f, -fh, fw, fh);
        g.ResetTransform();
    }
}
