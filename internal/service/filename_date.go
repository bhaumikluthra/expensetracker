package service

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// fileDateContext holds dates inferred from the uploaded CSV filename.
type fileDateContext struct {
	Found    bool
	Year     int
	Month    int
	StartDay int
	EndDay   int
	Label    string
}

func parseFilenameDate(filename string) fileDateContext {
	base := strings.TrimSuffix(strings.ToLower(filepathBase(filename)), ".csv")
	ctx := fileDateContext{}

	// Range: expenses_2025-01-15_to_2025-01-31 or 2025-01-01_2025-01-31
	rangeRe := regexp.MustCompile(`(\d{4})[-_/.](\d{1,2})[-_/.](\d{1,2}).*?(?:to|_|-)(\d{4})[-_/.](\d{1,2})[-_/.](\d{1,2})`)
	if m := rangeRe.FindStringSubmatch(base); len(m) == 7 {
		ctx.Found = true
		ctx.Year, _ = strconv.Atoi(m[1])
		ctx.Month, _ = strconv.Atoi(m[2])
		ctx.StartDay, _ = strconv.Atoi(m[3])
		y2, _ := strconv.Atoi(m[4])
		mo2, _ := strconv.Atoi(m[5])
		ctx.EndDay, _ = strconv.Atoi(m[6])
		if y2 == ctx.Year && mo2 == ctx.Month {
			ctx.Label = fmt.Sprintf("%04d-%02d-%02d to %02d", ctx.Year, ctx.Month, ctx.StartDay, ctx.EndDay)
			return normalizeFileDateCtx(ctx)
		}
	}

	// Single full date: 2025-01-15, 2025_01_15, 15-01-2025
	fullPatterns := []string{
		`(\d{4})[-_/.](\d{1,2})[-_/.](\d{1,2})`,
		`(\d{1,2})[-_/.](\d{1,2})[-_/.](\d{4})`,
	}
	for i, pat := range fullPatterns {
		re := regexp.MustCompile(pat)
		if m := re.FindStringSubmatch(base); len(m) == 4 {
			ctx.Found = true
			if i == 0 {
				ctx.Year, _ = strconv.Atoi(m[1])
				ctx.Month, _ = strconv.Atoi(m[2])
				ctx.StartDay, _ = strconv.Atoi(m[3])
			} else {
				ctx.StartDay, _ = strconv.Atoi(m[1])
				ctx.Month, _ = strconv.Atoi(m[2])
				ctx.Year, _ = strconv.Atoi(m[3])
			}
			ctx.EndDay = ctx.StartDay
			ctx.Label = fmt.Sprintf("%04d-%02d-%02d", ctx.Year, ctx.Month, ctx.StartDay)
			return normalizeFileDateCtx(ctx)
		}
	}

	// Month + year: 2025-01, 2025_01, jan_2025, january2025
	monthYear := regexp.MustCompile(`(\d{4})[-_/.](\d{1,2})(?:[^0-9]|$)`)
	if m := monthYear.FindStringSubmatch(base); len(m) == 3 {
		ctx.Found = true
		ctx.Year, _ = strconv.Atoi(m[1])
		ctx.Month, _ = strconv.Atoi(m[2])
		ctx.StartDay = 1
		ctx.EndDay = daysInMonth(ctx.Year, ctx.Month)
		ctx.Label = fmt.Sprintf("%04d-%02d (from filename)", ctx.Year, ctx.Month)
		return normalizeFileDateCtx(ctx)
	}

	for name, num := range monthNames {
		re := regexp.MustCompile(name + `[^a-z0-9]*(?:20)?(\d{2,4})`)
		if m := re.FindStringSubmatch(base); len(m) == 2 {
			ctx.Found = true
			ctx.Month = num
			ctx.Year = expandYear(m[1])
			ctx.StartDay = 1
			ctx.EndDay = daysInMonth(ctx.Year, ctx.Month)
			ctx.Label = fmt.Sprintf("%04d-%02d (from filename)", ctx.Year, ctx.Month)
			return normalizeFileDateCtx(ctx)
		}
	}

	// Year only: statement_2025
	yearOnly := regexp.MustCompile(`(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)`)
	if m := yearOnly.FindStringSubmatch(base); len(m) == 2 {
		ctx.Found = true
		ctx.Year, _ = strconv.Atoi(m[1])
		ctx.Month = int(time.Now().Month())
		ctx.StartDay = 1
		ctx.EndDay = daysInMonth(ctx.Year, ctx.Month)
		ctx.Label = fmt.Sprintf("%d (year from filename)", ctx.Year)
		return normalizeFileDateCtx(ctx)
	}

	return ctx
}

var monthNames = map[string]int{
	"january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
	"april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
	"august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9, "october": 10, "oct": 10,
	"november": 11, "nov": 11, "december": 12, "dec": 12,
}

func filepathBase(path string) string {
	path = strings.ReplaceAll(path, "\\", "/")
	if i := strings.LastIndex(path, "/"); i >= 0 {
		return path[i+1:]
	}
	return path
}

func expandYear(y string) int {
	n, _ := strconv.Atoi(y)
	if n < 100 {
		return 2000 + n
	}
	return n
}

func daysInMonth(year, month int) int {
	if month < 1 || month > 12 {
		return 28
	}
	return time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC).Day()
}

func normalizeFileDateCtx(ctx fileDateContext) fileDateContext {
	if ctx.Month < 1 || ctx.Month > 12 {
		ctx.Found = false
		return ctx
	}
	if ctx.Year < 1990 || ctx.Year > 2100 {
		ctx.Found = false
		return ctx
	}
	maxDay := daysInMonth(ctx.Year, ctx.Month)
	if ctx.StartDay < 1 {
		ctx.StartDay = 1
	}
	if ctx.EndDay < 1 || ctx.EndDay > maxDay {
		ctx.EndDay = maxDay
	}
	if ctx.StartDay > maxDay {
		ctx.StartDay = maxDay
	}
	if ctx.EndDay < ctx.StartDay {
		ctx.EndDay = ctx.StartDay
	}
	return ctx
}

// dateForRow assigns a date when CSV has no date column (uses filename + row index).
func (ctx fileDateContext) dateForRow(rowIndex int) (string, error) {
	if !ctx.Found {
		return "", fmt.Errorf("no date in filename")
	}
	day := ctx.StartDay + rowIndex
	if day > ctx.EndDay {
		day = ctx.EndDay
	}
	if day > daysInMonth(ctx.Year, ctx.Month) {
		day = daysInMonth(ctx.Year, ctx.Month)
	}
	t := time.Date(ctx.Year, time.Month(ctx.Month), day, 12, 0, 0, 0, time.UTC)
	return t.Format("2006-01-02"), nil
}

// mergeDayWithFileContext combines a day-of-month cell with month/year from filename.
func (ctx fileDateContext) mergeDayWithFileContext(dayStr string) (string, error) {
	if !ctx.Found {
		return "", fmt.Errorf("no month/year in filename")
	}
	day, err := strconv.Atoi(strings.TrimSpace(dayStr))
	if err != nil || day < 1 || day > 31 {
		return "", fmt.Errorf("invalid day %q", dayStr)
	}
	max := daysInMonth(ctx.Year, ctx.Month)
	if day > max {
		day = max
	}
	t := time.Date(ctx.Year, time.Month(ctx.Month), day, 12, 0, 0, 0, time.UTC)
	return t.Format("2006-01-02"), nil
}

func (ctx fileDateContext) promptHint() string {
	if !ctx.Found {
		return "No date detected in filename."
	}
	return fmt.Sprintf("Filename date hint: %s (use this when CSV rows lack a date column).", ctx.Label)
}
