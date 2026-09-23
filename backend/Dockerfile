FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props Helpdesk.sln ./
COPY src/Helpdesk.Domain/Helpdesk.Domain.csproj src/Helpdesk.Domain/
COPY src/Helpdesk.Persistence/Helpdesk.Persistence.csproj src/Helpdesk.Persistence/
COPY src/Helpdesk.Application/Helpdesk.Application.csproj src/Helpdesk.Application/
COPY src/Helpdesk.Infrastructure/Helpdesk.Infrastructure.csproj src/Helpdesk.Infrastructure/
COPY src/Helpdesk.Api/Helpdesk.Api.csproj src/Helpdesk.Api/
RUN dotnet restore src/Helpdesk.Api/Helpdesk.Api.csproj
COPY src/ src/
RUN dotnet publish src/Helpdesk.Api/Helpdesk.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Helpdesk.Api.dll"]
