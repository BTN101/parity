       IDENTIFICATION DIVISION.
       PROGRAM-ID. PAYROLL.
      * Weekly gross-to-net with overtime and two withholding tables.
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
       01  F-CODE                   PIC X(1).
       01  F-HOURS                  PIC X(20).
       01  F-RATE                   PIC X(20).
       01  HOURS                    PIC 9(3)V9.
       01  RATE                     PIC 9(3)V99.
       01  OT-HOURS                 PIC 9(3)V9.
       01  BASE-PAY                 PIC 9(5)V99.
       01  OT-PAY                   PIC 9(5)V99.
       01  GROSS                    PIC 9(5)V99.
       01  TAX                      PIC 9(5)V99.
       01  NET                      PIC S9(5)V99.
       01  O-GROSS                  PIC 9(5).99.
       01  O-TAX                    PIC 9(5).99.
       01  O-NET                    PIC -9(5).99.
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
               INTO F-CODE F-HOURS F-RATE
           COMPUTE HOURS = FUNCTION NUMVAL(F-HOURS)
           COMPUTE RATE  = FUNCTION NUMVAL(F-RATE)
           IF HOURS > 40
               COMPUTE OT-HOURS = HOURS - 40
               MULTIPLY 40 BY RATE GIVING BASE-PAY ROUNDED
               COMPUTE OT-PAY ROUNDED = OT-HOURS * RATE * 1.5
           ELSE
               MULTIPLY HOURS BY RATE GIVING BASE-PAY ROUNDED
               MOVE 0 TO OT-PAY
           END-IF
           ADD BASE-PAY OT-PAY GIVING GROSS
           IF F-CODE = 'M'
               IF GROSS > 2000
                   COMPUTE TAX ROUNDED = (GROSS - 2000) * 0.22 + 150
               ELSE
                   COMPUTE TAX ROUNDED = GROSS * 0.075
               END-IF
           ELSE
               IF GROSS > 1000
                   COMPUTE TAX ROUNDED = (GROSS - 1000) * 0.24 + 100
               ELSE
                   COMPUTE TAX ROUNDED = GROSS * 0.10
               END-IF
           END-IF
           SUBTRACT TAX FROM GROSS GIVING NET
           MOVE GROSS TO O-GROSS
           MOVE TAX   TO O-TAX
           MOVE NET   TO O-NET
           DISPLAY O-GROSS ',' O-TAX ',' O-NET.
