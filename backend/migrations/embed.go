// Package migrations embeds the SQL schema files so the compiled binary can
// apply them without the source tree being present.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
