import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * COBOL numeric storage semantics for Java.
 *
 * When a finding is marked PRESERVE, the modern code has to reproduce what the
 * legacy field does to a value on the way in. No Java numeric type does this
 * natively. Pic does, in one call:
 *
 *   Pic NEW_BAL = Pic.of("9(7)V99");
 *   BigDecimal stored = NEW_BAL.store(balance.add(interest).subtract(fee));
 *
 * store()        truncates to the field's decimals (COMPUTE without ROUNDED)
 * storeRounded() rounds half away from zero      (COMPUTE ... ROUNDED)
 * Both then drop leading digits the field cannot hold, and drop the sign if
 * the field has no S — silently, exactly as the legacy program does.
 */
public final class Pic {
    public final boolean signed;
    public final int intDigits;
    public final int scale;
    private final BigDecimal modulus;

    private Pic(boolean signed, int intDigits, int scale) {
        this.signed = signed;
        this.intDigits = intDigits;
        this.scale = scale;
        this.modulus = BigDecimal.TEN.pow(intDigits);
    }

    /** Parse a numeric PICTURE such as "S9(7)V99", "9V9999" or "9(3)". */
    public static Pic of(String picture) {
        String p = picture.toUpperCase();
        StringBuilder expanded = new StringBuilder();
        for (int i = 0; i < p.length(); i++) {
            char c = p.charAt(i);
            if (c == '(') {
                int close = p.indexOf(')', i);
                int n = Integer.parseInt(p.substring(i + 1, close));
                char prev = expanded.charAt(expanded.length() - 1);
                for (int k = 1; k < n; k++) expanded.append(prev);
                i = close;
            } else expanded.append(c);
        }
        String e = expanded.toString();
        boolean signed = e.startsWith("S");
        int v = e.indexOf('V');
        String left = v < 0 ? e : e.substring(0, v);
        String right = v < 0 ? "" : e.substring(v + 1);
        return new Pic(signed, count9(left), count9(right));
    }

    private static int count9(String s) {
        int n = 0;
        for (char c : s.toCharArray()) if (c == '9') n++;
        return n;
    }

    public BigDecimal store(BigDecimal value) {
        return fit(value.setScale(scale, RoundingMode.DOWN));
    }

    public BigDecimal storeRounded(BigDecimal value) {
        return fit(value.setScale(scale, RoundingMode.HALF_UP));
    }

    private BigDecimal fit(BigDecimal v) {
        BigDecimal magnitude = v.abs().remainder(modulus).setScale(scale, RoundingMode.UNNECESSARY);
        if (magnitude.signum() == 0) return magnitude;
        return (signed && v.signum() < 0) ? magnitude.negate() : magnitude;
    }

    /** Render like a COBOL edited picture: optional leading sign, zero-padded. */
    public static String edited(BigDecimal v, int intDigits, int scale, boolean signPosition) {
        String digits = v.abs().setScale(scale, RoundingMode.DOWN).toPlainString();
        String[] parts = digits.split("\\.");
        StringBuilder ip = new StringBuilder(parts[0]);
        while (ip.length() < intDigits) ip.insert(0, '0');
        String body = scale > 0 ? ip + "." + parts[1] : ip.toString();
        if (!signPosition) return body;
        return (v.signum() < 0 ? "-" : " ") + body;
    }
}
