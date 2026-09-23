import java.io.*;
import java.math.*;

// The translation after Parity's repair loop, with every finding marked
// PRESERVE: identical logic to Interest.java, but every store goes through Pic
// so the legacy fields' truncation and sign behaviour is reproduced exactly.
public class InterestFaithful {
    static final Pic BALANCE = Pic.of("S9(7)V99");
    static final Pic RATE = Pic.of("9V9999");
    static final Pic DAYS = Pic.of("9(3)");
    static final Pic INTEREST = Pic.of("S9(5)V99");
    static final Pic FEE = Pic.of("9(3)V99");
    static final Pic NEW_BAL = Pic.of("9(7)V99");
    static final BigDecimal DAYS_PER_YEAR = new BigDecimal("365");

    public static void main(String[] a) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = in.readLine()) != null) {
            String[] f = line.split(",");
            String type = f[0];
            BigDecimal balance = BALANCE.store(new BigDecimal(f[1].trim()));
            BigDecimal rate = RATE.store(new BigDecimal(f[2].trim()));
            BigDecimal days = DAYS.store(new BigDecimal(f[3].trim()));

            BigDecimal interest = INTEREST.storeRounded(
                balance.multiply(rate).multiply(days).divide(DAYS_PER_YEAR, 10, RoundingMode.HALF_UP));

            BigDecimal fee;
            if (type.equals("P")) fee = FEE.store(BigDecimal.ZERO);
            else if (balance.compareTo(new BigDecimal("1000")) < 0)
                // GnuCOBOL carries this intermediate product at four decimals.
                fee = FEE.store(new BigDecimal("12.50").add(
                    balance.multiply(new BigDecimal("0.001")).setScale(4, RoundingMode.DOWN)));
            else fee = FEE.store(new BigDecimal("5.00"));

            BigDecimal newBal = NEW_BAL.store(balance.add(interest).subtract(fee));

            out.append(Pic.edited(interest, 5, 2, true)).append(',')
               .append(Pic.edited(fee, 3, 2, false)).append(',')
               .append(Pic.edited(newBal, 7, 2, false)).append('\n');
        }
        System.out.print(out);
    }
}
