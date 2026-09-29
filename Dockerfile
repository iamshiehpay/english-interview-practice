FROM gcr.io/distroless/nodejs22-debian13:nonroot

ENV NODE_ENV=production \
    COACH_DEPLOYMENT_MODE=demo \
    HOST=0.0.0.0 \
    PORT=8080 \
    DEMO_WORKSPACE_ROOT=/tmp/interview-coach-demo \
    DEMO_SEED_DIR=/app/demo/seed

WORKDIR /app
COPY --chown=65532:65532 package.json ./
COPY --chown=65532:65532 src ./src
COPY --chown=65532:65532 public ./public
COPY --chown=65532:65532 demo/seed ./demo/seed

USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["src/server.js"]
