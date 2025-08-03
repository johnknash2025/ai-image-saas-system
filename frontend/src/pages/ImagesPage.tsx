import React, { useEffect, useState } from 'react';
import { Box, TextField, Button, CircularProgress, Alert, Grid, Card, CardMedia, CardContent, Typography, Paper } from '@mui/material';
import { useImageStore } from '../store/imageStore';

const ImagesPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const { images, isLoading, error, fetchImages, generateNewImage } = useImageStore();

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      generateNewImage(prompt);
      setPrompt('');
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom>
        Image Generation
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={10}>
              <TextField
                fullWidth
                label="Enter a prompt to generate an image"
                variant="outlined"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={2}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={isLoading || !prompt.trim()}
                sx={{ height: '56px' }}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Generate'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="h5" gutterBottom>
        Generated Images
      </Typography>

      {isLoading && images.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {images.map((image) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={image.id}>
              <Card>
                <CardMedia
                  component="img"
                  height="194"
                  image={image.url}
                  alt={image.prompt}
                />
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    {image.prompt}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!isLoading && images.length === 0 && (
        <Typography sx={{ mt: 4, textAlign: 'center' }}>
          No images generated yet. Use the form above to create one.
        </Typography>
      )}
    </Box>
  );
};

export default ImagesPage;