using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
	private static int Main(string[] args)
	{
		if (string.Equals(Environment.GetEnvironmentVariable("LEFTHOOK"), "0", StringComparison.Ordinal))
		{
			return 0;
		}

		var executablePath = Environment.GetCommandLineArgs()[0];
		var hookName = Path.GetFileName(executablePath);
		var hooksDirectory = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
		var hooksParent = Directory.GetParent(hooksDirectory);
		var repoRoot = hooksParent != null ? hooksParent.FullName : null;

		if (string.IsNullOrWhiteSpace(repoRoot))
		{
			Console.Error.WriteLine("Unable to determine repository root for Git hook.");
			return 1;
		}

		var forwardedArgs = args.Length > 0 ? " " + string.Join(" ", Array.ConvertAll(args, QuoteArgument)) : string.Empty;
		var startInfo = new ProcessStartInfo
		{
			FileName = "C:\\Windows\\System32\\cmd.exe",
			Arguments = string.Concat("/c pnpm.cmd exec lefthook run ", hookName, forwardedArgs),
			WorkingDirectory = repoRoot,
			UseShellExecute = false
		};

		using (var process = Process.Start(startInfo))
		{
			if (process == null)
			{
				Console.Error.WriteLine("Failed to start lefthook process.");
				return 1;
			}

			process.WaitForExit();
			return process.ExitCode;
		}
	}

	private static string QuoteArgument(string argument)
	{
		if (argument.IndexOfAny(new[] { ' ', '\t', '"' }) < 0)
		{
			return argument;
		}

		return "\"" + argument.Replace("\"", "\\\"") + "\"";
	}
}
