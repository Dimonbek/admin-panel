import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;

/** Namuna uchun oddiy rangli avatar rasmlar (ism bosh harfi bilan). */
public class SeedRasm {
    static final Color[] RANG = {
        new Color(0x2563EB), new Color(0x059669), new Color(0xD97706),
        new Color(0x7C3AED), new Color(0xDB2777), new Color(0x0891B2),
    };

    public static void main(String[] a) throws Exception {
        File up = new File(a[0]);
        up.mkdirs();
        // avatarlar
        String[] harf = {"A", "B", "D", "E", "F"};
        for (int i = 0; i < harf.length; i++) yarat(new File(up, "a" + (i + 1) + ".jpg"), harf[i], RANG[i % RANG.length], 160);
        // hodisa (selfi) rasmlari — biroz boshqacha rang
        String[] eh = {"A", "A", "B", "D", "E", "E"};
        for (int i = 0; i < eh.length; i++) yarat(new File(up, "e" + (i + 1) + ".jpg"), eh[i], RANG[(i + 2) % RANG.length], 320);
        System.out.println("rasmlar yasaldi: " + up);
    }

    static void yarat(File f, String harf, Color rang, int o) throws Exception {
        BufferedImage img = new BufferedImage(o, o, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(rang);
        g.fillRect(0, 0, o, o);
        g.setColor(Color.WHITE);
        g.setFont(new Font("SansSerif", Font.BOLD, (int) (o * 0.45)));
        FontMetrics fm = g.getFontMetrics();
        int x = (o - fm.stringWidth(harf)) / 2;
        int y = (o - fm.getHeight()) / 2 + fm.getAscent();
        g.drawString(harf, x, y);
        g.dispose();
        ImageIO.write(img, "jpg", f);
    }
}
