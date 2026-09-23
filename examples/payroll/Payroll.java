import java.io.*;
import java.math.*;

// A plausible modern translation. BigDecimal throughout, and HALF_EVEN
// ("banker's rounding") for money — the rounding mode most Java style guides
// recommend for currency. Reasonable, defensible, and not what COBOL does.
public class Payroll {
    static final BigDecimal FORTY = new BigDecimal("40");
    static final RoundingMode MONEY = RoundingMode.HALF_EVEN;

    public static void main(String[] a) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = in.readLine()) != null) {
            String[] f = line.split(",");
            String code = f[0];
            BigDecimal hours = new BigDecimal(f[1].trim()).setScale(1, RoundingMode.DOWN);
            BigDecimal rate = new BigDecimal(f[2].trim()).setScale(2, RoundingMode.DOWN);

            BigDecimal base, ot;
            if (hours.compareTo(FORTY) > 0) {
                base = FORTY.multiply(rate).setScale(2, MONEY);
                ot = hours.subtract(FORTY).multiply(rate).multiply(new BigDecimal("1.5")).setScale(2, MONEY);
            } else {
                base = hours.multiply(rate).setScale(2, MONEY);
                ot = BigDecimal.ZERO.setScale(2);
            }
            BigDecimal gross = base.add(ot);

            BigDecimal tax;
            if (code.equals("M")) {
                tax = gross.compareTo(new BigDecimal("2000")) > 0
                    ? gross.subtract(new BigDecimal("2000")).multiply(new BigDecimal("0.22")).add(new BigDecimal("150"))
                    : gross.multiply(new BigDecimal("0.075"));
            } else {
                tax = gross.compareTo(new BigDecimal("1000")) > 0
                    ? gross.subtract(new BigDecimal("1000")).multiply(new BigDecimal("0.24")).add(new BigDecimal("100"))
                    : gross.multiply(new BigDecimal("0.10"));
            }
            tax = tax.setScale(2, MONEY);
            BigDecimal net = gross.subtract(tax);

            out.append(pad(gross, 5)).append(',').append(pad(tax, 5)).append(',')
               .append(net.signum() < 0 ? "-" : " ").append(pad(net.abs(), 5)).append('\n');
        }
        System.out.print(out);
    }

    static String pad(BigDecimal v, int intDigits) {
        String[] p = v.setScale(2, RoundingMode.DOWN).toPlainString().split("\\.");
        StringBuilder ip = new StringBuilder(p[0]);
        while (ip.length() < intDigits) ip.insert(0, '0');
        return ip + "." + p[1];
    }
}
