       IDENTIFICATION DIVISION.
       PROGRAM-ID. INTEREST.
      * Legacy daily-interest and fee batch step.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-FILE ASSIGN TO KEYBOARD
               ORGANIZATION IS LINE SEQUENTIAL.
       DATA DIVISION.
       FILE SECTION.
       FD  IN-FILE.
       01  IN-LINE                  PIC X(80).
       WORKING-STORAGE SECTION.
       01  WS-EOF                   PIC X VALUE 'N'.
       01  F-TYPE                   PIC X(1).
       01  F-BAL                    PIC X(20).
       01  F-RATE                   PIC X(20).
       01  F-DAYS                   PIC X(20).
       01  BALANCE                  PIC S9(7)V99.
       01  RATE                     PIC 9V9999.
       01  DAYS                     PIC 9(3).
       01  INTEREST                 PIC S9(5)V99.
       01  FEE                      PIC 9(3)V99.
       01  NEW-BAL                  PIC 9(7)V99.
       01  O-INT                    PIC -9(5).99.
       01  O-FEE                    PIC 9(3).99.
       01  O-NEW                    PIC 9(7).99.
       PROCEDURE DIVISION.
       MAIN.
           OPEN INPUT IN-FILE
           PERFORM UNTIL WS-EOF = 'Y'
               READ IN-FILE
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END PERFORM PROCESS-ONE
               END-READ
           END-PERFORM
           CLOSE IN-FILE
           STOP RUN.
       PROCESS-ONE.
           UNSTRING IN-LINE DELIMITED BY ','
               INTO F-TYPE F-BAL F-RATE F-DAYS
           COMPUTE BALANCE = FUNCTION NUMVAL(F-BAL)
           COMPUTE RATE    = FUNCTION NUMVAL(F-RATE)
           COMPUTE DAYS    = FUNCTION NUMVAL(F-DAYS)
           COMPUTE INTEREST ROUNDED = BALANCE * RATE * DAYS / 365
           IF F-TYPE = 'P'
               MOVE 0 TO FEE
           ELSE
               IF BALANCE < 1000
                   COMPUTE FEE = 12.50 + BALANCE * 0.001
               ELSE
                   MOVE 5.00 TO FEE
               END-IF
           END-IF
           COMPUTE NEW-BAL = BALANCE + INTEREST - FEE
           MOVE INTEREST TO O-INT
           MOVE FEE      TO O-FEE
           MOVE NEW-BAL  TO O-NEW
           DISPLAY O-INT ',' O-FEE ',' O-NEW.
